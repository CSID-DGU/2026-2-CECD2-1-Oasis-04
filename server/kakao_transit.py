import json
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field, replace
from http.client import HTTPException
from os import environ
from time import monotonic
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from transit_labels import bus_labels, subway_line_id

PUBLIC_TRANSIT_URL = "https://dapi.kakao.com/v2/routing/publictraffic"
WALK_URL = "https://dapi.kakao.com/v2/routing/walk"


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
    bus_type: str | None = None
    line_id: str | None = None
    bus_types_by_name: dict[str, str | None] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class TransitRoute:
    """카카오맵 대중교통 경로 후보 한 건."""

    type: str = field(metadata={"description": "경로 유형. `BUS`(버스만), `SUBWAY`(전철만), `BUS_AND_SUBWAY`(버스+전철).", "examples": ["BUS"]})
    duration_seconds: int = field(metadata={"description": "카카오맵이 반환한 경로 전체 예상 소요 시간(초)", "examples": [1200]})
    distance_meters: int = field(metadata={"description": "카카오맵이 반환한 경로 전체 이동 거리(미터)", "examples": [4200]})
    transfers: int = field(metadata={"description": "카카오맵이 반환한 전체 환승 횟수. 0이면 환승 없음.", "examples": [0]})
    steps: list[TransitStep] = field(metadata={"description": "승객의 이동 순서대로 정렬된 경로 구간 목록"})
    exit: str | None = field(default=None, kw_only=True, metadata={"description": "마지막 지하철 하차역의 출구 번호. 확인되지 않으면 null."})


EXIT_NUMBER = r"[1-9][0-9]*(?:-[1-9][0-9]*)?"


def _arrival_exit(steps: list[TransitStep]) -> str | None:
    last = next((i for i in reversed(range(len(steps))) if steps[i].type != "WALKING"), None)
    if last is None or steps[last].type != "SUBWAY" or last + 1 == len(steps):
        return None

    guidance = steps[last + 1].guidance.strip()
    stops = steps[last].stop_names
    if stops:
        station = stops[-1].strip().removesuffix("역")
        if station:
            guidance = re.sub(rf"^{re.escape(station)}역?(?:에서|의)?\s*", "", guidance)
    # 첫 도보의 명시적인 출구 지시만 사용한다. 목적지·정류장 이름에도 출구 번호가 들어갈 수 있다.
    if guidance.count("출구") != 1:
        return None
    match = re.match(rf"^({EXIT_NUMBER})\s*번\s*출구로\s*(?:나가|나와|나오|나갑|나감)", guidance)
    return match[1] if match else None


def fetch_public_transit_routes(
    *,
    start_latitude: float,
    start_longitude: float,
    end_latitude: float,
    end_longitude: float,
    api_key: str | None = None,
) -> dict[str, Any]:
    """출발지와 도착지 좌표로 카카오맵 대중교통 경로를 조회한다."""
    key = api_key if api_key is not None else environ["KAKAO_REST_API_KEY"]

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
    vehicles = properties.get("vehicles") or []
    names = [vehicle["name"] for vehicle in vehicles]
    labels = bus_labels((v["name"], v.get("type")) for v in vehicles) if properties["type"] == "BUS" else {}
    return TransitStep(
        type=properties["type"],
        guidance=properties.get("guidance") or "",
        duration_seconds=properties["time"],
        distance_meters=properties["distance"],
        stop_names=[stop["name"] for stop in properties.get("stops") or []],
        vehicle_names=names,
        line_id=subway_line_id(names[0]) if properties["type"] == "SUBWAY" and names else None,
        **labels,
    )


def parse_public_transit_routes(payload: dict[str, Any]) -> list[TransitRoute]:
    """카카오맵 응답을 경로와 이동 구간으로 변환한다."""
    if payload["status"] in ("NO_RESULTS", "STARTNODES_NULL", "ENDNODES_NULL"):
        return []

    routes = []
    for route in payload["routes"]:
        properties = route["properties"]
        steps = [_parse_step(step) for step in route["steps"]]
        routes.append(
            TransitRoute(
                type=properties["type"],
                duration_seconds=properties["totalTime"],
                distance_meters=properties["totalDistance"],
                transfers=properties["transfers"],
                steps=steps,
                exit=_arrival_exit(steps),
            )
        )
    return routes


def _alighting_point(raw_steps):
    if not raw_steps or raw_steps[-1]["properties"]["type"] not in ("BUS", "SUBWAY"):
        return None
    points = (raw_steps[-1].get("path") or {}).get("points") or []
    if not points:
        return None
    point = points[-1]
    if not isinstance(point, (list, tuple)) or len(point) != 2 or any(type(v) not in (int, float) for v in point):
        return None
    x, y = point
    return (x, y) if -180 <= x <= 180 and -90 <= y <= 90 else None


def _walk_to_destination(start, destination, deadline):
    if start == destination:
        return 0, 0
    timeout = deadline - monotonic()
    if timeout <= 0:
        return None
    query = urlencode(dict(start_x=start[0], start_y=start[1], end_x=destination[0], end_y=destination[1]))
    request = Request(f"{WALK_URL}?{query}", headers={"Authorization": f"KakaoAK {environ['KAKAO_REST_API_KEY']}"})
    try:
        with urlopen(request, timeout=timeout) as response:
            payload = json.load(response)
        if payload.get("status") == "SAME_POINT":
            return 0, 0
        if payload.get("status", "OK") != "OK":
            return None
        properties = payload["route"]["properties"]
        values = properties["totalTime"], properties["totalDistance"]
        if all(type(v) is int and v >= 0 for v in values):
            return values
    except (OSError, HTTPException, ValueError, TypeError, KeyError, AttributeError):
        pass
    return None


def routes_with_final_walk(payload, end_longitude, end_latitude):
    routes = parse_public_transit_routes(payload)
    if not routes:
        return routes
    starts = [_alighting_point(raw["steps"]) for raw in payload["routes"]]
    unique = list(dict.fromkeys(start for start in starts if start is not None))
    if not unique:
        return routes
    destination = (end_longitude, end_latitude)
    deadline = monotonic() + 2
    with ThreadPoolExecutor(max_workers=min(4, len(unique))) as pool:
        walks = dict(zip(unique, pool.map(lambda start: _walk_to_destination(start, destination, deadline), unique)))
    for i, start in enumerate(starts):
        walk = walks.get(start)
        if walk is not None:
            seconds, meters = walk
            step = TransitStep("WALKING", "목적지까지 도보", seconds, meters, [], [])
            routes[i] = replace(routes[i], steps=[*routes[i].steps, step])
    return routes
