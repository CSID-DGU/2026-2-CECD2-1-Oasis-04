"""경로 후처리 테스트. 실제 카카오 응답의 구조를 본떠 만든 표본(tests/fixtures)을 쓰므로 지도 API 키 없이 돈다."""
import json
import os
import sys
import types
from datetime import datetime

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "server"))

from kakao import KakaoRouteProvider, parse  # noqa: E402
from routing import (RouteError, bus_label, eul, has_final, headline, ro, same_place, station,  # noqa: E402
                     to_response_routes, usable_vehicles)

FIXTURE = os.path.join(ROOT, "tests", "fixtures", "kakao_publictraffic_sample.json")
ORIGIN, DEST = (126.9918, 37.5704), (127.0490, 37.5045)    # 종로3가역 키오스크 → 선릉역 (경도, 위도)
WEEKDAY_NOON = datetime(2026, 11, 11, 14, 0)     # 수요일 낮
SATURDAY_NOON = datetime(2026, 11, 14, 14, 0)
WEEKDAY_NIGHT = datetime(2026, 11, 11, 2, 0)


@pytest.fixture()
def kakao_body():
    with open(FIXTURE, encoding="utf-8") as f:
        return json.load(f)


def respond(routes, now=WEEKDAY_NOON, **kw):
    """서버(server/app.py)가 부르는 것과 같은 방식: 출발·도착 좌표와 지금 시각을 함께 넘긴다"""
    return to_response_routes(routes, "선릉역", origin_xy=ORIGIN, dest_xy=DEST, now=now, **kw)


def test_parse_maps_kakao_fields_to_common_shape(kakao_body):
    routes, landing = parse(kakao_body)
    assert landing.startswith("https://map.kakao.com/link/by/traffic/")
    assert [r["type"] for r in routes] == ["MIXED", "SUBWAY", "BUS", "BUS"]
    first = routes[0]
    assert first["total_sec"] == 2736 and first["total_m"] == 10998 and first["transfers"] == 1
    assert [s["mode"] for s in first["steps"]] == ["SUBWAY", "WALK", "BUS"]
    assert first["steps"][0]["from_xy"] == [126.991877, 37.5715634] and first["steps"][2]["to_xy"] == [127.0486, 37.5052]
    assert first["steps"][1]["exit"] == "1" and first["steps"][0]["exit"] is None    # guidance 끝의 '(1번 출구)'
    assert first["steps"][2]["stops"][0] == "현대아파트" and first["steps"][2]["vehicles"][0] == {"name": "472", "type": "간선"}
    # 요금은 value 하나로 오거나, 탈 수 있는 버스마다 다르면 min·max 로 온다
    assert (routes[0]["fare"], routes[0]["fare_max"]) == (1650, None)
    assert (routes[3]["fare"], routes[3]["fare_max"]) == (1500, 2500)


@pytest.mark.parametrize("status,code", [
    ("NO_RESULTS", "ROUTE_NOT_FOUND"), ("STARTNODES_NULL", "ROUTE_NOT_FOUND"), ("ENDNODES_NULL", "ROUTE_NOT_FOUND"),
    ("EQUAL_POINTS", "ROUTE_TOO_CLOSE"), ("INVALID_REQUEST", "UPSTREAM_ERROR"), (None, "UPSTREAM_ERROR"),
])
def test_parse_maps_status_to_error_code(status, code):
    with pytest.raises(RouteError) as e:
        parse({"status": status})
    assert e.value.code == code


def test_routes_are_reranked_by_elder_score(kakao_body):
    out = respond(parse(kakao_body)[0])
    # 점수 = 분 + 10×환승 + 2×(도보m/100). 도보는 전체 거리에서 타고 가는 거리를 뺀 값이라 단계에 없는 앞뒤 도보도 들어간다
    #   지하철 33+10+2×3.0 = 49.0, 버스 45+0+2×3.0 = 51.0, 지하철+버스 46+10+2×8.1 = 72.2. 심야버스 경로는 낮이라 빠진다
    assert [r["path_type"] for r in out] == ["SUBWAY", "BUS", "MIXED"]
    assert [r["rank"] for r in out] == [1, 2, 3]
    assert [r["elder_score"] for r in out] == [49.0, 51.0, 72.2]
    assert out[0]["total_min"] == 33 and out[0]["transfers"] == 1 and out[0]["walk_m"] == 300
    assert out[0]["headline"] == "33분 · 1번 갈아타요 · 300미터 걸어요"
    assert out[1]["headline"] == "45분 · 갈아타지 않아요 · 300미터 걸어요"
    assert (out[1]["fare"], out[1]["fare_max"]) == (1500, 2500)


def test_easy_text_restores_outer_walks(kakao_body):
    subway, bus, mixed = respond(parse(kakao_body)[0])
    assert subway["summary"] == "지하철 3호선 → 지하철 2호선"
    assert [s["easy_text"] for s in subway["steps"]] == [
        "종로3가역 3호선 타는 곳까지 150미터 걸어가세요.",                 # 응답에 없는 출발지→타는 곳 도보를 합계에서 복원
        "종로3가역에서 3호선을 타고, 3정거장 가서 교대역에서 내리세요.",      # '교대(법원.검찰청)' 의 괄호는 뺀다
        "교대역에서 2호선으로 갈아타세요. 140미터쯤 걸어요.",
        "교대역에서 2호선을 타고, 3정거장 가서 선릉역에서 내리세요.",        # 내린 역이 목적지라 마지막 도보 문장은 없다
    ]
    assert [s["order"] for s in subway["steps"]] == [1, 2, 3, 4]
    assert subway["steps"][0]["mode"] == "WALK" and subway["steps"][0]["distance_m"] == 150
    assert subway["steps"][1]["board"] == "종로3가" and subway["steps"][1]["alight"] == "교대"

    assert [s["easy_text"] for s in bus["steps"]] == [
        "종로3가역.탑골공원 정류장까지 260미터 걸어가세요.",
        "종로3가역.탑골공원 정류장에서 파란 버스 146번을 타고, 2정거장 가서 선릉역 정류장에서 내리세요.",
        "선릉역까지 40미터 걸어가세요.",
    ]
    # 운행 조건이 붙은 8146(평일) 은 뒤로 보내고 조건 없는 146 을 먼저 안내한다
    assert bus["summary"] == "버스 146번" and bus["steps"][1]["line_alternatives"] == ["9401", "8146"]

    assert mixed["summary"] == "지하철 3호선 → 버스 472번"
    assert mixed["steps"][2]["easy_text"] == "1번 출구로 나와서 현대아파트 정류장까지 410미터 걸어가세요."
    assert mixed["steps"][3]["line_alternatives"] == ["4312"]      # 같은 차량이 두 번 와도 한 번만
    assert mixed["steps"][4]["easy_text"] == "선릉역까지 160미터 걸어가세요."


def test_vehicles_that_do_not_run_now_are_dropped(kakao_body):
    routes = parse(kakao_body)[0]
    assert "버스 N15번" not in [r["summary"] for r in respond(routes, now=WEEKDAY_NOON)]
    night = respond(routes, now=WEEKDAY_NIGHT)
    assert night[0]["summary"] == "버스 N15번"
    assert night[0]["steps"][1]["easy_text"].startswith("종로3가역.탑골공원 정류장에서 심야버스 N15번을 타고")
    # 주말에는 평일에만 다니는 8146 을 빼고 안내한다
    weekend_bus = next(r for r in respond(routes, now=SATURDAY_NOON) if r["summary"] == "버스 146번")
    assert weekend_bus["steps"][1]["line_alternatives"] == ["9401"]
    # 시각을 주지 않으면 거르지 않는다
    assert "버스 N15번" in [r["summary"] for r in respond(routes, now=None)]
    assert usable_vehicles([{"name": "N15(심야)", "type": "간선"}], WEEKDAY_NOON) == []


def test_without_coordinates_outer_walk_is_counted_but_not_narrated(kakao_body):
    # 좌표가 없으면 앞뒤 도보를 어디에 얼마나 둘지 알 수 없으므로 걷는 거리에만 넣고 문장은 만들지 않는다
    subway = next(r for r in to_response_routes(parse(kakao_body)[0], "선릉역") if r["path_type"] == "SUBWAY")
    assert subway["walk_m"] == 300 and [s["mode"] for s in subway["steps"]] == ["SUBWAY", "WALK", "SUBWAY"]


def test_routes_with_same_stops_are_merged():
    def bus_route(number, fare, sec):
        return {"type": "BUS", "total_sec": sec, "total_m": 3000, "transfers": 0, "fare": fare, "fare_max": None,
                "steps": [{"mode": "BUS", "sec": sec - 300, "m": 2700, "stops": ["탑골공원", "남대문시장"],
                           "vehicles": [{"name": number, "type": "간선"}]}]}

    out = to_response_routes([bus_route("9301", 3200, 1200), bus_route("201", 1500, 1260), bus_route("262", 1500, 1320)], "남대문시장")
    # 타고 내리는 곳이 같으면 한 경로로 보고, 요금이 싼 버스를 앞세운다
    assert len(out) == 1 and out[0]["summary"] == "버스 201번" and out[0]["fare"] == 1500
    assert out[0]["steps"][0]["line_alternatives"] == ["9301", "262"]


def test_transfer_sentences():
    route = {"type": "MIXED", "total_sec": 1700, "total_m": 6372, "transfers": 2, "fare": 1550, "steps": [
        {"mode": "BUS", "sec": 1000, "m": 4000, "stops": ["탑골공원", "용두동신동아아파트"], "vehicles": [{"name": "370", "type": "간선"}]},
        {"mode": "WALK", "sec": 110, "m": 92, "stops": ["용두동신동아아파트", "용두동신동아아파트"], "vehicles": []},
        {"mode": "BUS", "sec": 250, "m": 1200, "stops": ["용두동신동아아파트", "제기동역.서울약령시"], "vehicles": [{"name": "120", "type": "간선"}]},
        {"mode": "WALK", "sec": 200, "m": 180, "stops": ["제기동역.서울약령시", "제기동"], "vehicles": [], "exit": "2"},
        {"mode": "SUBWAY", "sec": 140, "m": 900, "stops": ["제기동", "청량리(서울시립대입구)"], "vehicles": [{"name": "1호선", "type": "일반"}]},
    ]}
    texts = [s["easy_text"] for s in to_response_routes([route], "청량리역")[0]["steps"]]
    assert texts[1] == "내린 곳에서 90미터 걸어가서 갈아타세요. 타는 곳 이름도 용두동신동아아파트예요."
    assert texts[3] == "제기동역 2번 출구까지 180미터 걸어가세요."
    assert texts[4] == "제기동역에서 1호선을 타고, 1정거장 가서 청량리역에서 내리세요."

    # 내린 정류장이 곧 목적지면 마지막 도보 문장을 넣지 않는다
    to_stop = {"type": "BUS", "total_sec": 900, "total_m": 3050, "transfers": 0, "fare": 1500, "steps": [
        {"mode": "WALK", "sec": 60, "m": 0, "stops": [], "vehicles": []},
        {"mode": "BUS", "sec": 800, "m": 3000, "stops": ["천호역.풍납시장", "서울아산병원동관"], "vehicles": [{"name": "4318", "type": "지선"}]},
    ]}
    steps = to_response_routes([to_stop], "서울아산병원동관 정류장")[0]["steps"]
    assert [s["mode"] for s in steps] == ["BUS"]
    assert [s["mode"] for s in to_response_routes([to_stop], "서울아산병원")[0]["steps"]] == ["BUS", "WALK"]


def test_max_routes_is_capped_at_three(kakao_body):
    routes = parse(kakao_body)[0]
    assert len(respond(routes, now=None, max_routes=10)) == 3
    assert len(respond(routes, max_routes=1)) == 1


def test_korean_helpers():
    assert has_final("선릉") and not has_final("교대") and has_final("273") and not has_final("472")
    assert eul("2호선") == "2호선을" and eul("273번") == "273번을" and eul("버스") == "버스를"
    assert ro("2호선") == "2호선으로" and ro("우이신설") == "우이신설로" and ro("버스") == "버스로"
    assert station("교대(법원.검찰청)") == "교대역" and station("서울역") == "서울역"
    assert same_place("선릉", "선릉역") and same_place("서울아산병원동관", "서울아산병원동관 정류장")
    assert not same_place("제기동", "경동시장 정류장") and not same_place("", "역")
    assert headline(12, 0, 0) == "12분 · 갈아타지 않아요 · 거의 안 걸어요"
    assert bus_label({"name": "273", "type": "간선"}) == "파란 버스 273번"
    assert bus_label({"name": "9401", "type": "직행"}) == "빨간 버스 9401번"
    assert bus_label({"name": "6011", "type": "공항"}) == "공항버스 6011번"
    assert bus_label({"name": "N15(심야)", "type": "간선"}) == "심야버스 N15번"
    assert bus_label({"name": "112-5", "type": "일반"}) == "112-5번 버스"


class FakeResponse:
    def __init__(self, status_code, body):
        self.status_code = status_code
        self._body = body

    def json(self):
        return self._body


def make_provider(monkeypatch, responses):
    """httpx 를 가짜 모듈로 바꿔 끼운 제공자. responses 는 차례로 돌려줄 응답 목록이고, 문자열이면 연결 오류로 던진다."""
    class FakeHTTPError(Exception):
        pass

    calls = []

    def fake_get(url, params=None, headers=None, timeout=None):
        calls.append({"url": url, "params": params, "headers": headers})
        item = responses[min(len(calls), len(responses)) - 1]
        if isinstance(item, str):
            raise FakeHTTPError(item)
        return item

    monkeypatch.setitem(sys.modules, "httpx", types.SimpleNamespace(get=fake_get, HTTPError=FakeHTTPError))
    return KakaoRouteProvider(api_key="k" * 32), calls


def test_provider_sends_key_in_header_and_parses(monkeypatch, kakao_body):
    provider, calls = make_provider(monkeypatch, [FakeResponse(200, kakao_body)])
    routes, landing = provider.search(126.9918, 37.5704, 127.049, 37.5045, "출발지", "선릉역")
    assert len(routes) == 4 and landing
    assert calls[0]["headers"] == {"Authorization": "KakaoAK " + "k" * 32}
    assert calls[0]["params"]["start_x"] == 126.9918 and calls[0]["params"]["e_name"] == "선릉역"


def test_provider_reports_map_disabled_app(monkeypatch):
    # 카카오맵 사용 설정이 꺼진 앱의 실제 응답 모양 (HTTP 403, {errorType, message})
    body = {"errorType": "NotAuthorizedError", "message": "App(테스트) disabled OPEN_MAP_AND_LOCAL service."}
    provider, calls = make_provider(monkeypatch, [FakeResponse(403, body)])
    with pytest.raises(RouteError) as e:
        provider.search(126.9918, 37.5704, 127.049, 37.5045)
    assert e.value.code == "UPSTREAM_ERROR" and len(calls) == 1
    assert "403" in e.value.message and "NotAuthorizedError" in e.value.message and "disabled" in e.value.message


def test_provider_masks_key_in_error_message(monkeypatch):
    provider, _ = make_provider(monkeypatch, [FakeResponse(401, {"code": -401, "msg": "InvalidAppKey " + "k" * 32})])
    with pytest.raises(RouteError) as e:
        provider.search(126.9918, 37.5704, 127.049, 37.5045)
    assert "k" * 32 not in e.value.message and "***" in e.value.message and "-401" in e.value.message


def test_provider_retries_once_then_gives_up(monkeypatch, kakao_body):
    provider, calls = make_provider(monkeypatch, ["timeout", FakeResponse(200, kakao_body)])
    assert len(provider.search(126.9918, 37.5704, 127.049, 37.5045)[0]) == 4 and len(calls) == 2

    provider, calls = make_provider(monkeypatch, [FakeResponse(503, {})])
    with pytest.raises(RouteError) as e:
        provider.search(126.9918, 37.5704, 127.049, 37.5045)
    assert e.value.code == "UPSTREAM_ERROR" and "503" in e.value.message and len(calls) == 2


def test_provider_without_key_does_not_call(monkeypatch):
    provider, calls = make_provider(monkeypatch, [FakeResponse(200, {})])
    provider.api_key = ""
    with pytest.raises(RouteError) as e:
        provider.search(126.9918, 37.5704, 127.049, 37.5045)
    assert e.value.code == "UPSTREAM_ERROR" and not provider.configured and calls == []
