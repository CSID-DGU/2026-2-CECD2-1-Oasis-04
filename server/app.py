from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Request

from kakao_transit import (
    KakaoTransitConfigurationError,
    TransitRoute,
    fetch_public_transit_routes,
    parse_public_transit_routes,
)
from place_search import PlaceSearch
from places import Place, load_places

Latitude = Annotated[float, Query(ge=-90, le=90)]
Longitude = Annotated[float, Query(ge=-180, le=180)]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.place_search = PlaceSearch(load_places())
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/places/search")
def search_places(request: Request, q: Annotated[str, Query(min_length=1, description="장소 검색어")]) -> list[Place]:
    search: PlaceSearch = request.app.state.place_search
    return search.search(q)


@app.get(
    "/routes/transit",
    responses={
        502: {"description": "카카오맵 대중교통 경로 조회 실패"},
        503: {"description": "카카오맵 REST API 키 미설정"},
    },
)
def get_transit_routes(
    start_latitude: Latitude,
    start_longitude: Longitude,
    end_latitude: Latitude,
    end_longitude: Longitude,
) -> list[TransitRoute]:
    """출발지와 도착지의 위도·경도로 대중교통 경로를 조회한다."""
    if (start_latitude, start_longitude) == (end_latitude, end_longitude):
        raise HTTPException(status_code=422, detail="출발지와 도착지 좌표는 달라야 합니다.")

    try:
        payload = fetch_public_transit_routes(
            start_latitude=start_latitude,
            start_longitude=start_longitude,
            end_latitude=end_latitude,
            end_longitude=end_longitude,
        )
        return parse_public_transit_routes(payload)
    except KakaoTransitConfigurationError as exc:
        raise HTTPException(status_code=503, detail="대중교통 길찾기 서비스가 설정되지 않았습니다.") from exc
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="카카오맵에서 대중교통 경로를 가져오지 못했습니다.") from exc
