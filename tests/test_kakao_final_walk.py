import io
import json
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1] / "server"))
import kakao_transit as kakao


def candidate(kind, point):
    step = {"properties": {"type": kind, "time": 60, "distance": 100}, "path": {"points": [point]}}
    return {"properties": {"type": "BUS", "totalTime": 720, "totalDistance": 900, "transfers": 0}, "steps": [step]}


def test_only_missing_walks_are_fetched_once_per_point(monkeypatch):
    calls = []

    def walk(request, timeout):
        calls.append(urlsplit(request.full_url))
        return io.BytesIO(b'{"status":"OK","route":{"properties":{"totalTime":185,"totalDistance":211}}}')

    monkeypatch.setenv("KAKAO_REST_API_KEY", "test")
    monkeypatch.setattr(kakao, "urlopen", walk)
    rows = [candidate(kind, [127, 37]) for kind in ("BUS", "SUBWAY", "WALKING")]
    rows.extend([candidate("BUS", None), candidate("BUS", [127.1, 37.1])])
    result = kakao.routes_with_final_walk({"status": "OK", "routes": rows}, 127.1, 37.1)
    assert len(calls) == 1 and calls[0].path == "/v2/routing/walk"
    assert parse_qs(calls[0].query) == {"start_x": ["127"], "start_y": ["37"], "end_x": ["127.1"], "end_y": ["37.1"]}
    assert [len(r.steps) for r in result] == [2, 2, 1, 1, 2]
    assert [(r.steps[-1].duration_seconds, r.steps[-1].distance_meters) for r in result[:2]] == [(185, 211)] * 2
    assert result[0].steps[-1].type == "WALKING" and result[0].duration_seconds == 720
    assert result[-1].steps[-1].duration_seconds == 0


@pytest.mark.parametrize("response", [None, {"status": "ROUTE_RESULT_NOT_FOUND"}, {"status": "OK", "route": {}}])
def test_walk_failure_preserves_transit_route(monkeypatch, response):
    def walk(request, timeout):
        if response is None:
            raise TimeoutError()
        return io.BytesIO(json.dumps(response).encode())

    monkeypatch.setenv("KAKAO_REST_API_KEY", "test")
    monkeypatch.setattr(kakao, "urlopen", walk)
    result = kakao.routes_with_final_walk({"status": "OK", "routes": [candidate("BUS", [127, 37])]}, 127.1, 37.1)
    assert [step.type for step in result[0].steps] == ["BUS"]
