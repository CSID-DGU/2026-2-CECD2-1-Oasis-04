import json
from os import getenv
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PUBLIC_TRANSIT_URL = "https://dapi.kakao.com/v2/routing/publictraffic"


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
