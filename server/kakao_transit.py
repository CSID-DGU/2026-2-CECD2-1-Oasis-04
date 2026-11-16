import json
from dataclasses import dataclass
from os import getenv
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PUBLIC_TRANSIT_URL = "https://dapi.kakao.com/v2/routing/publictraffic"


class KakaoTransitResponseError(ValueError):
    """카카오맵 응답에서 경로를 읽을 수 없을 때 발생한다."""


@dataclass(frozen=True, slots=True)
class TransitStep:
    type: str
    guidance: str
    duration_seconds: int
    distance_meters: int
    stop_names: list[str]
    vehicle_names: list[str]


@dataclass(frozen=True, slots=True)
class TransitRoute:
    type: str
    duration_seconds: int
    distance_meters: int
    transfers: int
    steps: list[TransitStep]


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
        raise ValueError("KAKAO_REST_API_KEY is not configured")

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
    if not isinstance(payload, dict):
        raise KakaoTransitResponseError("Invalid Kakao transit response")
    status = payload.get("status")
    if status in ("NO_RESULTS", "STARTNODES_NULL", "ENDNODES_NULL"):
        return []
    if status != "OK":
        raise KakaoTransitResponseError(f"Kakao transit search failed: {status}")

    raw_routes = payload.get("routes")
    if not isinstance(raw_routes, list):
        raise KakaoTransitResponseError("Invalid Kakao transit route list")

    routes = []
    try:
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
    except (KeyError, TypeError) as exc:
        raise KakaoTransitResponseError("Invalid Kakao transit route data") from exc
    return routes
