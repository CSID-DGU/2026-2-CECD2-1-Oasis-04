"""경로 백업: 카카오맵 길찾기가 실패할 때 ODsay 대중교통 길찾기로 대신 찾는다 (2026-11-22 방선우 추가).

카카오맵 쪽(kakao_transit.py)과 같은 TransitRoute·TransitStep 으로 바꾸므로, 정렬과 한국어 안내(route_guidance.py)는 그대로 쓴다.
  - 구간의 guidance 는 카카오맵과 같은 모양으로 만든다: "간선 273외 1대 (출발 > 도착)", "수도권 3호선 (출발 > 도착)".
    화면이 이 앞머리에서 버스 종류를, 노선 이름에서 노선 색을 읽는다 (frontend/src/api/real/routeLegs.js)
  - 카카오맵과 달리 ODsay 는 출발지에서 첫 정류장까지, 마지막 정류장에서 목적지까지 걷는 구간도 준다.
    거리와 시간이 모두 0 인 걷기(같은 곳에서 갈아타기)는 뺀다

ODsay (https://lab.odsay.com, 2026-11-22 문서 확인)
  - 길찾기: GET https://api.odsay.com/v1/api/searchPubTransPathT?SX=&SY=&EX=&EY=&apiKey=   (X 경도, Y 위도. 시간은 분, 거리는 미터)
  - 무료(Basic) 요금제는 하루 30회까지다. 넘기지 않게 여기서도 하루 횟수를 센다 (DailyLimit. 서버를 다시 띄우면 0 부터)
  - 키는 환경변수 ODSAY_API_KEY (카카오 키와 같은 방식). 없으면 백업만 꺼진다. 로그와 오류 문구에 키를 남기지 않는다
  - 실제 ODsay 응답으로 확인하지 못했다 (키가 없었다). 문서의 출력 항목대로 만들었으니 키를 받은 뒤 한 번 확인한다

표준 라이브러리만 쓴다.
"""
import datetime
import json
import urllib.error
from os import environ
from typing import Any, Callable
from urllib.parse import urlencode
from urllib.request import urlopen

from kakao_transit import TransitRoute, TransitStep
from transit_labels import bus_labels, subway_line_id

ODSAY_URL = "https://api.odsay.com/v1/api/searchPubTransPathT"
KEY_NAME = "ODSAY_API_KEY"
LIMIT_NAME = "ODSAY_DAILY_LIMIT"
DEFAULT_DAILY_LIMIT = 30
TIMEOUT_SECONDS = 6
PROVIDERS = ("auto", "kakao", "odsay")

# ODsay 버스노선 타입 → 카카오맵 안내 문구의 앞머리와 같은 글자. 그 밖(급행·외곽·관광 등)은 "버스"
BUS_TYPES = {1: "일반", 2: "좌석", 3: "마을", 4: "직행", 5: "공항", 11: "간선", 12: "지선", 13: "순환", 14: "광역"}
PATH_TYPES = {1: "SUBWAY", 2: "BUS", 3: "BUS_AND_SUBWAY"}
# 경로가 없다는 뜻의 ODsay 오류 코드: 출발·도착 정류장 없음(3·4·5), 서비스 지역 아님(6), 700m 이내(-98), 결과 없음(-99)
NO_ROUTE_CODES = {"3", "4", "5", "6", "-98", "-99"}


class OdsayError(Exception):
    """백업 조회 실패. code 는 NOT_CONFIGURED(키 없음) | LIMIT(하루 한도) | UPSTREAM(ODsay 오류·응답 없음)"""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def api_key() -> str:
    return (environ.get(KEY_NAME) or "").strip()


def kst_today(now: datetime.datetime | None = None) -> str:
    now = now or datetime.datetime.now(datetime.timezone.utc)
    return (now + datetime.timedelta(hours=9)).strftime("%Y-%m-%d")


class DailyLimit:
    """하루(한국 날짜) 호출 횟수. 한도를 넘기면 부르지 않는다."""

    def __init__(self, limit: int = DEFAULT_DAILY_LIMIT):
        self.limit = int(limit)
        self.day = ""
        self.count = 0

    def used(self, now: datetime.datetime | None = None) -> int:
        return self.count if self.day == kst_today(now) else 0

    def left(self, now: datetime.datetime | None = None) -> int:
        return max(0, self.limit - self.used(now))

    def take(self, now: datetime.datetime | None = None) -> bool:
        """한 번 쓴다. 한도가 남아 있으면 True."""
        today = kst_today(now)
        if self.day != today:
            self.day, self.count = today, 0
        if self.count >= self.limit:
            return False
        self.count += 1
        return True

    def add(self, now: datetime.datetime | None = None) -> int:
        """한도와 상관없이 한 번 센다 (막지 않고 세기만 할 때). 오늘 센 횟수를 돌려준다."""
        today = kst_today(now)
        if self.day != today:
            self.day, self.count = today, 0
        self.count += 1
        return self.count


def _unique(names) -> list[str]:
    return list(dict.fromkeys(name for name in names if name))


def _stop_names(sub: dict[str, Any]) -> list[str]:
    stations = (sub.get("passStopList") or {}).get("stations") or []
    names = [name for name in (str(station.get("stationName") or "").strip() for station in stations) if name]
    return names if len(names) >= 2 else [name for name in (sub.get("startName"), sub.get("endName")) if name]


def _parse_step(sub: dict[str, Any], between_rides: bool) -> TransitStep | None:
    kind = sub.get("trafficType")
    seconds = int(sub.get("sectionTime") or 0) * 60
    meters = int(round(float(sub.get("distance") or 0)))
    if kind == 3:
        if seconds == 0 and meters == 0:
            return None
        return TransitStep(type="WALKING", guidance="환승" if between_rides else "", duration_seconds=seconds,
                           distance_meters=meters, stop_names=[], vehicle_names=[])
    lanes = sub.get("lane") or []
    stops = _stop_names(sub)
    span = f" ({stops[0]} > {stops[-1]})" if len(stops) >= 2 else ""
    if kind == 2:
        numbers = _unique(str(lane.get("busNo") or "").strip() for lane in lanes)
        word = BUS_TYPES.get(lanes[0].get("type"), "버스") if lanes else "버스"
        more = f"외 {len(numbers) - 1}대" if len(numbers) > 1 else ""
        return TransitStep(type="BUS", guidance=f"{word} {numbers[0] if numbers else ''}{more}{span}".strip(),
                           duration_seconds=seconds, distance_meters=meters, stop_names=stops, vehicle_names=numbers,
                           **bus_labels((str(lane.get("busNo") or "").strip(), BUS_TYPES.get(lane.get("type"))) for lane in lanes))
    if kind == 1:
        name = str((lanes[0].get("name") if lanes else "") or "").strip()
        return TransitStep(type="SUBWAY", guidance=f"{name}{span}", duration_seconds=seconds, distance_meters=meters,
                           stop_names=stops, vehicle_names=[name] if name else [], line_id=subway_line_id(name))
    return None


def _parse_route(path: dict[str, Any]) -> TransitRoute:
    info = path.get("info") or {}
    subs = path.get("subPath") or []
    ride_indexes = [i for i, sub in enumerate(subs) if sub.get("trafficType") in (1, 2)]
    first, last = (ride_indexes[0], ride_indexes[-1]) if ride_indexes else (0, -1)
    steps = [step for i, sub in enumerate(subs) if (step := _parse_step(sub, first < i < last))]
    return TransitRoute(
        type=PATH_TYPES.get(path.get("pathType"), "BUS_AND_SUBWAY"),
        duration_seconds=int(info.get("totalTime") or 0) * 60,
        distance_meters=int(round(float(info.get("totalDistance") or 0))),
        transfers=max(0, int(info.get("busTransitCount") or 0) + int(info.get("subwayTransitCount") or 0) - 1),
        steps=steps,
    )


def _error_of(payload: dict[str, Any]) -> tuple[str, str] | None:
    """ODsay 오류 → (코드, 문구). 오류는 {error: {code, msg}} 또는 {error: [{code, message}]} 로 온다."""
    error = payload.get("error")
    if not error:
        return None
    first = error[0] if isinstance(error, list) else error
    if not isinstance(first, dict):
        return "", str(first)
    return str(first.get("code", "")).strip(), str(first.get("msg") or first.get("message") or "").strip()


def parse_odsay_routes(payload: Any) -> list[TransitRoute]:
    """ODsay 응답을 경로와 이동 구간으로 변환한다. 경로가 없다는 오류와 도시간 결과는 빈 목록, 그 밖의 오류는 OdsayError."""
    if not isinstance(payload, dict):
        raise OdsayError("UPSTREAM", "unexpected response")
    error = _error_of(payload)
    if error:
        code, message = error
        if code in NO_ROUTE_CODES:
            return []
        raise OdsayError("UPSTREAM", f"ODsay {code}: {message}"[:200])
    result = payload.get("result") or {}
    if result.get("searchType", 0) != 0:
        return []  # 도시간(열차·고속버스) 결과는 안내하지 않는다
    routes = [_parse_route(path) for path in result.get("path") or []]
    return [route for route in routes if any(step.type != "WALKING" for step in route.steps)]


def fetch_odsay_routes(
    *,
    start_latitude: float,
    start_longitude: float,
    end_latitude: float,
    end_longitude: float,
    key: str | None = None,
    opener: Callable[..., Any] | None = None,
) -> list[TransitRoute]:
    """출발지와 도착지 좌표로 ODsay 대중교통 경로를 조회한다."""
    key = api_key() if key is None else key
    if not key:
        raise OdsayError("NOT_CONFIGURED", f"{KEY_NAME} is not set")
    params = urlencode({"SX": start_longitude, "SY": start_latitude, "EX": end_longitude, "EY": end_latitude,
                        "OPT": 0, "SearchType": 0, "SearchPathType": 0, "apiKey": key})
    try:
        with (opener or urlopen)(f"{ODSAY_URL}?{params}", timeout=TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise OdsayError("UPSTREAM", f"ODsay HTTP {error.code}") from None  # 주소(키 포함)는 남기지 않는다
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
        raise OdsayError("UPSTREAM", f"ODsay {type(error).__name__}") from None
    return parse_odsay_routes(payload)


def usage_status(configured: bool, usage: DailyLimit) -> dict[str, Any]:
    """길찾기 제공자 하나의 상태: 키가 있는지, 오늘 부른 횟수, 하루 한도. 키 값은 넣지 않는다.

    횟수는 이 서버가 켜진 뒤 센 것이다. 서버를 다시 띄우면 0 부터 세고, 같은 키를 다른 곳에서 쓴 횟수는 모른다.
    (카카오맵과 ODsay 모두 응답에 남은 횟수를 알려 주지 않는다)
    """
    return {"configured": bool(configured), "used_today": usage.used(), "daily_limit": usage.limit}


class Backup:
    """ODsay 백업의 상태(키, 오늘 쓴 횟수)와 호출."""

    def __init__(self, limit: DailyLimit | None = None, fetch: Callable[..., list[TransitRoute]] = fetch_odsay_routes):
        self.limit = limit or DailyLimit(int(environ.get(LIMIT_NAME) or DEFAULT_DAILY_LIMIT))
        self._fetch = fetch

    def configured(self) -> bool:
        return bool(api_key())

    def ready(self) -> bool:
        """지금 부를 수 있는가: 키가 있고 오늘 한도가 남았다."""
        return self.configured() and self.limit.left() > 0

    def status(self) -> dict[str, Any]:
        return usage_status(self.configured(), self.limit)

    def routes(self, **coordinates: float) -> list[TransitRoute]:
        """ODsay 에 한 번 묻는다. 키가 없으면 NOT_CONFIGURED, 한도를 넘으면 LIMIT (둘 다 ODsay 를 부르지 않는다)."""
        if not self.configured():
            raise OdsayError("NOT_CONFIGURED", f"{KEY_NAME} is not set")
        if not self.limit.take():
            raise OdsayError("LIMIT", f"daily limit {self.limit.limit} reached")
        return self._fetch(**coordinates)


def find_routes(
    provider: str,
    from_kakao: Callable[[], list[TransitRoute]],
    backup: Backup,
    **coordinates: float,
) -> tuple[list[TransitRoute], str]:
    """경로를 찾는다 → (경로 목록, 준 곳 "KAKAO" | "ODSAY").

    auto   카카오맵 먼저. 카카오맵이 실패하고 백업을 쓸 수 있으면 ODsay 로 한 번 더 찾는다.
           백업을 쓸 수 없거나 백업도 실패하면 카카오맵의 오류를 그대로 올린다 (백업을 붙이기 전과 같은 동작)
    kakao  카카오맵만
    odsay  ODsay 만 (백업이 되는지 볼 때). 실패하면 OdsayError
    카카오맵이 "경로 없음"(빈 목록)으로 답한 것은 실패가 아니므로 백업을 부르지 않는다.
    """
    if provider == "odsay":
        return backup.routes(**coordinates), "ODSAY"
    try:
        return from_kakao(), "KAKAO"
    except Exception:
        if provider == "kakao" or not backup.ready():
            raise
        try:
            return backup.routes(**coordinates), "ODSAY"
        except OdsayError:
            pass
        raise
