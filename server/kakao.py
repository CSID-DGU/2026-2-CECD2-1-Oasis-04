"""카카오맵 대중교통 경로 조회 (GET https://dapi.kakao.com/v2/routing/publictraffic) 제공자.

2026-07-21 부터 카카오맵 API 에 추가된 기능이다. 무료 쿼터는 하루 1,000건이고 개발자 계정의 첫 번째
카카오맵 활성화 앱에만 주어진다. 쿼터를 넘으면 유료 사용 설정을 하지 않는 한 호출이 거절될 뿐 과금되지 않는다.
응답은 요청 처리 중에만 쓰고 저장하지 않는다 (카카오 운영 정책, 계획서 4.2절).

parse() 는 외부 호출이 없는 순수 함수다. 응답 필드는 카카오 문서 기준이며, 문서에 없는 값이 와도 죽지 않게 읽는다.
  routes[].properties: type(BUS|SUBWAY|BUS_AND_SUBWAY), totalDistance(m), totalTime(초), transfers,
                       fare.value(원) 또는 fare.min·fare.max (탈 수 있는 버스마다 요금이 다를 때)
  routes[].steps[].properties: type(BUS|SUBWAY|WALKING), distance(m), time(초), stops[].name, vehicles[].{name,type}, guidance
  routes[].steps[].path.points: [[x, y], ...]

실제 응답에서 확인한 점 (2026-11):
  - 걷는 단계는 갈아탈 때만 온다. 출발지→첫 정류장, 마지막 정류장→목적지 도보는 합계에만 들어 있다 (routing.outer_walk 가 복원)
  - 지하철에서 나와 버스로 갈아탈 때 guidance 끝에 '(1번 출구)' 가 붙는다
  - 차량 이름에 '8641(평일)', 'N15(심야)' 처럼 운행 조건이 붙고, 같은 차량이 여러 번 나오기도 한다
  - 요청에 시각을 줄 수 없어서 낮에도 심야버스 경로가 섞여 온다 (routing.usable_vehicles 가 거른다)
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from routing import RouteError  # noqa: E402

URL = "https://dapi.kakao.com/v2/routing/publictraffic"
TYPE_MAP = {"BUS": "BUS", "SUBWAY": "SUBWAY", "BUS_AND_SUBWAY": "MIXED"}
MODE_MAP = {"BUS": "BUS", "SUBWAY": "SUBWAY", "WALKING": "WALK"}
EXIT_RE = re.compile(r"\((\d+(?:-\d+)?)번 출구\)")


def _xy(point):
    """[x, y] 좌표 쌍이면 실수 두 개로, 아니면 None"""
    if isinstance(point, (list, tuple)) and len(point) >= 2:
        try:
            return [float(point[0]), float(point[1])]
        except (TypeError, ValueError):
            return None
    return None


def parse(body: dict) -> tuple[list[dict], str | None]:
    """카카오 응답 본문 → (공통 경로 목록, 카카오맵 길찾기 화면 URL). status 가 OK 가 아니면 RouteError."""
    status = body.get("status")
    if status != "OK":
        if status == "EQUAL_POINTS":
            raise RouteError("ROUTE_TOO_CLOSE", "kakao: origin and destination are the same point")
        if status in ("NO_RESULTS", "STARTNODES_NULL", "ENDNODES_NULL"):
            raise RouteError("ROUTE_NOT_FOUND", f"kakao: {status}")
        raise RouteError("UPSTREAM_ERROR", f"kakao: unexpected status {status!r}")

    routes = []
    for r in body.get("routes") or []:
        p = r.get("properties") or {}
        steps = []
        for s in r.get("steps") or []:
            sp = s.get("properties") or {}
            mode = MODE_MAP.get(sp.get("type"))
            if mode is None:
                continue
            path = s.get("path")
            points = (path.get("points") or []) if isinstance(path, dict) else []
            guidance = str(sp.get("guidance") or "")
            exit_no = EXIT_RE.search(guidance) if mode == "WALK" else None
            steps.append({
                "mode": mode,
                "sec": int(sp.get("time") or 0),
                "m": int(sp.get("distance") or 0),
                "stops": [str(x.get("name")) for x in (sp.get("stops") or []) if isinstance(x, dict) and x.get("name")],
                "vehicles": [{"name": str(v.get("name", "")), "type": str(v.get("type", ""))}
                             for v in (sp.get("vehicles") or []) if isinstance(v, dict)],
                "from_xy": _xy(points[0]) if points else None,
                "to_xy": _xy(points[-1]) if points else None,
                "exit": exit_no.group(1) if exit_no else None,
                "guidance": guidance,
            })
        if not steps:
            continue
        f = p.get("fare") if isinstance(p.get("fare"), dict) else {}
        fare = f.get("value", f.get("min"))
        routes.append({
            "type": TYPE_MAP.get(p.get("type"), "MIXED"),
            "total_sec": int(p.get("totalTime") or 0),
            "total_m": int(p.get("totalDistance") or 0),
            "transfers": int(p.get("transfers") or 0),
            "fare": int(fare) if fare is not None else None,
            "fare_max": int(f["max"]) if f.get("max") is not None else None,
            "steps": steps,
        })
    if not routes:
        raise RouteError("ROUTE_NOT_FOUND", "kakao: status OK but no routes")
    landing = (body.get("properties") or {}).get("landingURL")
    return routes, landing


class KakaoRouteProvider:
    name = "kakao"

    def __init__(self, api_key: str | None = None, timeout: float = 3.0, retries: int = 1):
        self.api_key = api_key or os.environ.get("KAKAO_REST_API_KEY", "")
        self.timeout = timeout
        self.retries = retries

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def search(self, sx: float, sy: float, ex: float, ey: float, s_name: str = "출발", e_name: str = "도착"):
        """출발·도착 좌표(WGS84 경도 x, 위도 y)로 경로를 찾는다. (공통 경로 목록, landing_url) 을 돌려준다."""
        if not self.api_key:
            raise RouteError("UPSTREAM_ERROR", "KAKAO_REST_API_KEY is not set")
        import httpx

        params = {"start_x": sx, "start_y": sy, "end_x": ex, "end_y": ey, "s_name": s_name, "e_name": e_name}
        headers = {"Authorization": f"KakaoAK {self.api_key}"}
        last = "no attempt"
        for _ in range(self.retries + 1):
            try:
                res = httpx.get(URL, params=params, headers=headers, timeout=self.timeout)
            except httpx.HTTPError as e:   # 연결 실패·시간 초과 → 한 번 더
                last = f"{type(e).__name__}: {e}"
                continue
            if res.status_code >= 500:
                last = f"HTTP {res.status_code}"
                continue
            try:
                body = res.json()
            except ValueError:
                raise RouteError("UPSTREAM_ERROR", f"kakao: HTTP {res.status_code}, body is not JSON") from None
            if not isinstance(body, dict):
                raise RouteError("UPSTREAM_ERROR", f"kakao: HTTP {res.status_code}, body is not a JSON object")
            if res.status_code != 200:
                # 키 오류(401), 카카오맵 사용 설정이 꺼진 앱(403 NotAuthorizedError), 쿼터 초과(429) 등.
                # 오류 본문은 {errorType, message} 또는 {code, msg} 두 모양으로 온다.
                # 카카오 오류 문구에 앱 키가 그대로 들어오는 경우가 있어서 가린다 (응답·로그에 키가 남지 않게)
                code = body.get("errorType", body.get("code"))
                msg = str(body.get("message") or body.get("msg") or "").replace(self.api_key, "***")
                raise RouteError("UPSTREAM_ERROR", f"kakao: HTTP {res.status_code} code={code} msg={msg}")
            return parse(body)
        raise RouteError("UPSTREAM_ERROR", f"kakao: {last}")
