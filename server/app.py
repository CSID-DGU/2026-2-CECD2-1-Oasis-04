from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Annotated, Any, Literal

from fastapi import FastAPI, HTTPException, Query, Request

from kakao_transit import (
    KakaoTransitConfigurationError,
    fetch_public_transit_routes,
    parse_public_transit_routes,
)
from place_search import PlaceSearch
from places import Place, load_places
from route_guidance import GuidedTransitRoute, add_route_guidance


@dataclass
class HealthStatus:
    status: Literal["ok"]


@dataclass
class TransitError:
    detail: str


@dataclass
class TransitValidationError:
    detail: str | list[dict[str, Any]]


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
    response_description="카카오맵이 반환한 순서의 경로 후보와 한국어 안내. 조회된 경로가 없으면 빈 배열.",
    responses={
        422: {"model": TransitValidationError, "description": "필수 좌표 누락, 유효하지 않은 좌표 또는 출발·도착 좌표가 동일함"},
        502: {"model": TransitError, "description": "카카오맵 대중교통 경로를 조회하거나 응답을 처리하지 못함"},
        503: {"model": TransitError, "description": "서버에 카카오맵 REST API 키가 설정되지 않음"},
    },
)
def get_transit_routes(
    start_latitude: Annotated[float, Query(ge=-90, le=90, description="출발지 위도(WGS84 십진도)", examples=[37.568])],
    start_longitude: Annotated[float, Query(ge=-180, le=180, description="출발지 경도(WGS84 십진도)", examples=[126.991])],
    end_latitude: Annotated[float, Query(ge=-90, le=90, description="도착지 위도(WGS84 십진도)", examples=[37.505])],
    end_longitude: Annotated[float, Query(ge=-180, le=180, description="도착지 경도(WGS84 십진도)", examples=[127.049])],
) -> list[GuidedTransitRoute]:
    """출발지와 도착지의 위도·경도로 카카오맵 대중교통 경로를 조회한다.

    경로별로 전체 소요 시간(초), 거리(미터), 환승 횟수와 이동 구간 목록을 반환한다.
    `summary`는 교통수단·소요 시간·환승 횟수의 요약이고,
    `instructions`는 `steps` 순서에 맞춘 한국어 안내다.
    `steps`의 `guidance`는 카카오맵이 제공한 원본 문구다.
    목적지까지의 마지막 도보 구간은 카카오맵 응답에 들어 있는 경우에만 반환된다.
    """
    if (start_latitude, start_longitude) == (end_latitude, end_longitude):
        raise HTTPException(status_code=422, detail="출발지와 도착지 좌표는 달라야 합니다.")

    try:
        payload = fetch_public_transit_routes(
            start_latitude=start_latitude,
            start_longitude=start_longitude,
            end_latitude=end_latitude,
            end_longitude=end_longitude,
        )
        routes = parse_public_transit_routes(payload)
    except KakaoTransitConfigurationError as exc:
        raise HTTPException(status_code=503, detail="대중교통 길찾기 서비스가 설정되지 않았습니다.") from exc
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="카카오맵에서 대중교통 경로를 가져오지 못했습니다.") from exc

    return [add_route_guidance(route) for route in routes]
