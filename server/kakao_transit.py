import json
from dataclasses import dataclass, field
from os import getenv
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PUBLIC_TRANSIT_URL = "https://dapi.kakao.com/v2/routing/publictraffic"


class KakaoTransitConfigurationError(ValueError):
    """카카오맵 REST API 키가 설정되지 않았을 때 발생한다."""


@dataclass(frozen=True, slots=True)
class TransitStep:
    """대중교통 경로의 이동 구간 한 건."""

    type: str = field(metadata={"description": "구간 유형. `BUS`(버스), `SUBWAY`(전철), `WALKING`(도보).", "examples": ["BUS"]})
    guidance: str = field(
        metadata={"description": "카카오맵 원본 구간 안내 문구. 제공되지 않으면 빈 문자열.", "examples": ["간선 101 (출발 정류장 > 도착 정류장)"]}
    )
    duration_seconds: int = field(metadata={"description": "이 구간의 예상 소요 시간(초)", "examples": [1200]})
    distance_meters: int = field(metadata={"description": "이 구간의 이동 거리(미터)", "examples": [4200]})
    stop_names: list[str] = field(
        metadata={"description": "카카오맵 순서의 정류장·역 이름 목록. 값이 없으면 빈 배열.", "examples": [["출발 정류장", "도착 정류장"]]}
    )
    vehicle_names: list[str] = field(
        metadata={"description": "버스 번호·전철 노선 이름 목록. 중복 이름이 있을 수 있으며 값이 없으면 빈 배열.", "examples": [["101", "102"]]}
    )


@dataclass(frozen=True, slots=True)
class TransitRoute:
    """카카오맵 대중교통 경로 후보 한 건."""

    type: str = field(metadata={"description": "경로 유형. `BUS`(버스만), `SUBWAY`(전철만), `BUS_AND_SUBWAY`(버스+전철).", "examples": ["BUS"]})
    duration_seconds: int = field(metadata={"description": "카카오맵이 반환한 경로 전체 예상 소요 시간(초)", "examples": [1200]})
    distance_meters: int = field(metadata={"description": "카카오맵이 반환한 경로 전체 이동 거리(미터)", "examples": [4200]})
    transfers: int = field(metadata={"description": "카카오맵이 반환한 전체 환승 횟수. 0이면 환승 없음.", "examples": [0]})
    steps: list[TransitStep] = field(metadata={"description": "승객의 이동 순서대로 정렬된 경로 구간 목록"})


def fetch_public_transit_routes(
    *,
    start_latitude: float,
    start_longitude: float,
    end_latitude: float,
    end_longitude: float,
    api_key: str | None = None,
) -> dict[str, Any]:
    """출발지와 도착지 좌표로 카카오맵 대중교통 경로를 조회한다."""
    key = (api_key if api_key is not None else getenv("KAKAO_REST_API_KEY", "")).strip()
    if not key:
        raise KakaoTransitConfigurationError("KAKAO_REST_API_KEY is not configured")

    params = urlencode(
        {
            "start_x": start_longitude,
            "start_y": start_latitude,
            "end_x": end_longitude,
            "end_y": end_latitude,
        }
    )
    request = Request(
        f"{PUBLIC_TRANSIT_URL}?{params}",
        headers={"Authorization": f"KakaoAK {key}"},
        method="GET",
    )
    with urlopen(request, timeout=10) as response:
        return json.load(response)


def _parse_step(step: dict[str, Any]) -> TransitStep:
    properties = step["properties"]
    return TransitStep(
        type=properties["type"],
        guidance=properties.get("guidance") or "",
        duration_seconds=properties["time"],
        distance_meters=properties["distance"],
        stop_names=[stop["name"] for stop in properties.get("stops") or []],
        vehicle_names=[vehicle["name"] for vehicle in properties.get("vehicles") or []],
    )


def parse_public_transit_routes(payload: dict[str, Any]) -> list[TransitRoute]:
    """카카오맵 응답을 경로와 이동 구간으로 변환한다."""
    status = payload["status"]
    if status in ("NO_RESULTS", "STARTNODES_NULL", "ENDNODES_NULL"):
        return []
    if status != "OK":
        raise ValueError(f"Kakao transit search failed: {status}")

    raw_routes = payload["routes"]
    if not isinstance(raw_routes, list):
        raise ValueError("Invalid Kakao transit route list")

    routes = []
    for route in raw_routes:
        properties = route["properties"]
        routes.append(
            TransitRoute(
                type=properties["type"],
                duration_seconds=properties["totalTime"],
                distance_meters=properties["totalDistance"],
                transfers=properties["transfers"],
                steps=[_parse_step(step) for step in route["steps"]],
            )
        )
    return routes
