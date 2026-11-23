from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from os import environ
from secrets import token_urlsafe
from typing import Annotated, Literal

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import HTMLResponse

from kakao_transit import fetch_public_transit_routes, parse_public_transit_routes
from odsay_transit import Backup, DailyLimit, OdsayError, find_routes, usage_status
from place_search import PlaceSearch
from places import Place, load_places
from route_guidance import GuidedTransitRoute, add_route_guidance
from route_landing import landing_page, save_landings


@dataclass
class HealthStatus:
    status: Literal["ok"]


@dataclass
class ProviderStatus:
    """길찾기 제공자 하나의 상태. 키 값은 내보내지 않는다."""

    configured: bool
    used_today: int
    daily_limit: int


@dataclass
class RouteStatus:
    kakao: ProviderStatus
    odsay: ProviderStatus


# 카카오맵이 실패할 때 쓰는 ODsay 백업 (odsay_transit.py). 키는 환경변수 ODSAY_API_KEY, 없으면 백업만 꺼진다
route_backup = Backup()
# 카카오맵을 오늘 몇 번 불렀는지 (막지 않고 세기만 한다). 하루 한도는 무료 쿼터 1,000건이고 환경변수 KAKAO_DAILY_LIMIT 로 바꾼다
kakao_usage = DailyLimit(int(environ.get("KAKAO_DAILY_LIMIT") or 1000))
# 백업 실패를 알리는 HTTP 상태: 키 없음 503, 하루 한도 429, ODsay 오류 502
BACKUP_ERROR_STATUS = {"NOT_CONFIGURED": 503, "LIMIT": 429, "UPSTREAM": 502}


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.place_search = PlaceSearch(load_places())
    yield


app = FastAPI(
    title="Oasis 교통 안내 API",
    description="버스정류장·지하철역 이름 검색과 카카오맵 기반 대중교통 경로 조회를 제공한다.",
    lifespan=lifespan,
)


@app.get("/health", tags=["상태"], summary="서버 상태 확인", response_model=HealthStatus)
async def health():
    """서버가 요청을 받을 수 있으면 `{"status": "ok"}`를 반환한다. 카카오맵 연결 상태는 검사하지 않는다."""
    return {"status": "ok"}


@app.get(
    "/places/search",
    tags=["장소"],
    summary="버스정류장·지하철역 이름 검색",
    response_description="이름 유사도가 높은 순서대로 최대 5개. 문자나 숫자가 없는 검색어에는 빈 배열.",
)
def search_places(
    request: Request,
    q: Annotated[str, Query(min_length=1, description="검색할 버스정류장 또는 지하철역 이름", examples=["서울역"])],
) -> list[Place]:
    """서버 시작 시 읽은 정류장·역 목록에서 장소명을 검색한다.

    공백과 기호를 제거한 뒤 글자 단위 코사인 유사도를 비교한다.
    이름과 유형이 모두 같은 후보는 CSV에서 처음 읽은 한 건으로 대표한다.
    유사도가 같으면 CSV 로딩 순서를 따르고, 점수가 0인 후보도 포함될 수 있다.
    `q`를 생략하거나 빈 문자열을 보내면 `422`가 반환된다.
    """
    search: PlaceSearch = request.app.state.place_search
    return search.search(q)


@app.get(
    "/routes/transit",
    tags=["길찾기"],
    summary="대중교통 경로 및 한국어 안내 조회",
    response_description="환승 횟수, 총 소요 시간 순으로 오름차순 정렬한 경로와 한국어 안내. 경로가 없으면 빈 배열.",
    responses={
        200: {
            "content": {
                "application/json": {
                    "examples": {
                        "bus_route": {
                            "summary": "환승 없는 버스 경로",
                            "value": [
                                {
                                    "summary": "버스만 이용해요. 약 20분 걸려요. 갈아타지 않아요.",
                                    "instructions": ["출발 정류장에서 101번, 102번 버스 중 한 대를 타세요. 도착 정류장에서 내리세요."],
                                    "type": "BUS",
                                    "landing_url": "https://routes.example.org/routes/qr?route_id=example",
                                    "duration_seconds": 1200,
                                    "distance_meters": 4200,
                                    "transfers": 0,
                                    "steps": [
                                        {
                                            "type": "BUS",
                                            "guidance": "버스 101, 102 (출발 > 도착)",
                                            "duration_seconds": 1200,
                                            "distance_meters": 4200,
                                            "stop_names": ["출발", "도착"],
                                            "vehicle_names": ["101", "102"],
                                        },
                                    ],
                                }
                            ],
                        },
                        "no_routes": {"summary": "조회된 경로 없음", "value": []},
                    }
                }
            }
        },
    },
)
def get_transit_routes(
    request: Request,
    response: Response,
    start_latitude: Annotated[float, Query(ge=-90, le=90, description="출발지 위도(WGS84 십진도)", examples=[37.568])],
    start_longitude: Annotated[float, Query(ge=-180, le=180, description="출발지 경도(WGS84 십진도)", examples=[126.991])],
    end_latitude: Annotated[float, Query(ge=-90, le=90, description="도착지 위도(WGS84 십진도)", examples=[37.505])],
    end_longitude: Annotated[float, Query(ge=-180, le=180, description="도착지 경도(WGS84 십진도)", examples=[127.049])],
    provider: Annotated[
        Literal["auto", "kakao", "odsay"],
        Query(description="경로를 찾을 곳. `auto`: 카카오맵, 실패하면 ODsay 백업. `kakao`: 카카오맵만. `odsay`: ODsay 만(백업 확인용)"),
    ] = "auto",
) -> list[GuidedTransitRoute]:
    """출발지와 도착지의 위도·경도로 카카오맵 대중교통 경로를 조회한다.

    카카오맵 조회가 실패하면 ODsay 로 한 번 더 찾는다 (환경변수 `ODSAY_API_KEY` 가 있고 하루 한도가 남았을 때).
    ODsay 결과도 같은 모양으로 돌려주며, 어디서 받았는지는 응답 헤더 `X-Route-Provider`(`KAKAO` 또는 `ODSAY`)에 적는다.
    백업을 쓸 수 없거나 백업도 실패하면 카카오맵만 쓸 때와 같이 `500` 이다.
    `provider=odsay` 로 ODsay 만 부를 때는 키가 없으면 `503`, 하루 한도를 넘으면 `429`, ODsay 오류면 `502` 를 반환한다.

    경로별로 전체 소요 시간(초), 거리(미터), 환승 횟수와 이동 구간 목록을 반환한다.
    환승 횟수가 적은 경로가 먼저 나오며, 같은 경우 총 소요 시간이 짧은 경로가 먼저 나온다.
    두 값이 모두 같으면 카카오맵 응답의 순서를 따른다.
    `summary`는 교통수단·소요 시간·환승 횟수의 요약이고,
    `instructions`는 `steps` 순서에 맞춘 한국어 안내다.
    `steps`의 `guidance`는 카카오맵이 제공한 원본 문구다.
    목적지까지의 마지막 도보 구간은 카카오맵 응답에 들어 있는 경우에만 반환된다.
    """
    coordinates = {
        "start_latitude": start_latitude,
        "start_longitude": start_longitude,
        "end_latitude": end_latitude,
        "end_longitude": end_longitude,
    }
    def from_kakao():
        kakao_usage.add()
        return parse_public_transit_routes(fetch_public_transit_routes(**coordinates))

    try:
        routes, source = find_routes(provider, from_kakao, route_backup, **coordinates)
    except OdsayError as error:
        # provider=odsay 일 때만 여기로 온다. auto 에서는 카카오맵의 오류가 그대로 올라간다
        raise HTTPException(status_code=BACKUP_ERROR_STATUS.get(error.code, 502), detail=f"BACKUP_{error.code}: {error}") from None
    response.headers["X-Route-Provider"] = source
    routes.sort(key=lambda route: (route.transfers, route.duration_seconds))
    base = (environ.get("ROUTE_PUBLIC_BASE_URL") or str(request.base_url)).rstrip("/")
    entries = []
    for route in routes:
        route_id = token_urlsafe(16)
        guided = add_route_guidance(route, f"{base}/routes/qr?route_id={route_id}")
        entries.append((route_id, guided))
    save_landings(entries)
    return [guided for _, guided in entries]


@app.get("/routes/qr", response_class=HTMLResponse, tags=["길찾기"], summary="선택한 경로의 휴대폰 안내")
def open_route(route_id: str):
    html, status = landing_page(route_id)
    return HTMLResponse(html, status_code=status, headers={"Cache-Control": "no-store"})


@app.get("/routes/status", tags=["길찾기"], summary="길찾기 제공자(카카오맵·ODsay) 상태", response_model=RouteStatus)
def get_route_status():
    """카카오맵과 ODsay 각각 키가 설정돼 있는지, 오늘 부른 횟수와 하루 한도를 반환한다.

    횟수는 이 서버가 켜진 뒤 센 것이다. 서버를 다시 띄우면 0 부터 세고, 같은 키를 다른 곳에서 쓴 횟수는 포함하지 않는다.
    카카오맵과 ODsay 모두 응답에 남은 횟수를 알려 주지 않아 서버가 직접 센다.
    """
    return {"kakao": usage_status(bool(environ.get("KAKAO_REST_API_KEY")), kakao_usage), "odsay": route_backup.status()}
