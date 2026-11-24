"""경로 백업(ODsay, server/odsay_transit.py) 테스트. 실제 ODsay 를 부르지 않는다: 문서의 출력 항목대로 만든 예시 응답을 쓴다."""
import datetime
import io
import json
import os
import sys
import urllib.error

import pytest

SERVER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server")
if SERVER not in sys.path:
    sys.path.append(SERVER)   # 맨 뒤에 넣는다 (server/places.py 등이 kb/·stt/ 의 모듈을 가리지 않게)
from kakao_transit import TransitRoute, TransitStep  # noqa: E402
from odsay_transit import (Backup, DailyLimit, OdsayError, fetch_odsay_routes, find_routes, kst_today,  # noqa: E402
                           parse_odsay_routes, usage_status)


def walk(minutes, meters):
    return {"trafficType": 3, "distance": meters, "sectionTime": minutes}


def subway(code, name, start, end, minutes, stations=None):
    return {"trafficType": 1, "distance": 4200, "sectionTime": minutes, "stationCount": len(stations or [start, end]) - 1,
            "lane": [{"name": name, "subwayCode": code, "subwayCityCode": 1000}], "startName": start, "endName": end,
            "way": "오금", "wayCode": 2, "endExitNo": "6",
            "passStopList": {"stations": [{"index": i, "stationName": n} for i, n in enumerate(stations or [start, end])]}}


def bus(lanes, start, end, minutes, stations=None):
    return {"trafficType": 2, "distance": 3100, "sectionTime": minutes, "stationCount": len(stations or [start, end]) - 1,
            "lane": [{"busNo": no, "type": kind, "busID": 100 + i} for i, (no, kind) in enumerate(lanes)],
            "startName": start, "endName": end,
            "passStopList": {"stations": [{"index": i, "stationName": n} for i, n in enumerate(stations or [start, end])]}}


def path(path_type, total_min, bus_count, subway_count, subs, distance=6400):
    return {"pathType": path_type,
            "info": {"totalTime": total_min, "totalWalk": 300, "totalDistance": distance, "payment": 1550,
                     "busTransitCount": bus_count, "subwayTransitCount": subway_count},
            "subPath": subs}


SUBWAY_PATH = path(1, 14, 0, 1, [
    walk(3, 200),
    subway(3, "수도권 3호선", "종로3가", "동대입구", 6, stations=["종로3가", "을지로3가", "충무로", "동대입구"]),
    walk(5, 350),
])
BUS_PATH = path(2, 30, 1, 0, [
    walk(2, 120),
    bus([("273", 11), ("271", 11), ("273", 11)], "종로3가.탑골공원", "동대입구역.장충동", 20,
        stations=["종로3가.탑골공원", "종로4가.종묘", "동대입구역.장충동"]),
    walk(1, 60),
])
MIXED_PATH = path(3, 25, 1, 1, [
    walk(2, 100),
    bus([("7212", 12)], "종로3가", "을지로3가", 8),
    walk(0, 0),                                        # 같은 곳에서 갈아타기: 구간으로 만들지 않는다
    subway(3, "수도권 3호선", "을지로3가", "동대입구", 4),
    walk(4, 250),
])
WALK_TRANSFER_PATH = path(3, 28, 1, 1, [
    walk(2, 100),
    bus([("7212", 12)], "종로3가", "을지로3가", 8),
    walk(3, 180),                                      # 내려서 다른 곳까지 걸어가 갈아타기
    subway(3, "수도권 3호선", "을지로3가", "동대입구", 4),
    walk(4, 250),
])


def result(*paths, search_type=0):
    return {"result": {"searchType": search_type, "path": list(paths)}}


def one(payload_path) -> TransitRoute:
    return parse_odsay_routes(result(payload_path))[0]


def test_routes_use_the_same_dataclasses_as_the_kakao_side():
    route = one(SUBWAY_PATH)
    assert isinstance(route, TransitRoute) and all(isinstance(step, TransitStep) for step in route.steps)
    assert (route.type, route.duration_seconds, route.distance_meters, route.transfers) == ("SUBWAY", 840, 6400, 0)
    assert [step.type for step in route.steps] == ["WALKING", "SUBWAY", "WALKING"]


def test_exit_belongs_to_final_ride():
    assert one(SUBWAY_PATH).exit == "6"
    assert one(BUS_PATH).exit is None
    subs = SUBWAY_PATH["subPath"] + BUS_PATH["subPath"]
    assert one(path(3, 44, 1, 1, subs)).exit is None


@pytest.mark.parametrize(("rides", "final_walk", "expected"), [
    (["SUBWAY"], "동대입구역 6번 출구로 나가세요.", "6"),
    (["SUBWAY"], "3-1번 출구로 나와서 걸어가세요.", "3-1"),
    (["SUBWAY"], "6번 출구 앞 약국까지 도보", None),
    (["SUBWAY"], "6번 출구 또는 7번 출구로 나가세요.", None),
    (["SUBWAY"], None, None),
    (["SUBWAY", "BUS"], "6번 출구로 나가세요.", None),
])
def test_kakao_arrival_exit(rides, final_walk, expected):
    from kakao_transit import parse_public_transit_routes

    def step(kind, guidance):
        return {"properties": {"type": kind, "guidance": guidance, "time": 60, "distance": 100, "stops": [{"name": "동대입구"}]}}

    steps = [step("WALKING", "2번 출구로 나가세요.")]
    for ride in rides:
        steps.append(step(ride, ""))
    if final_walk:
        steps.append(step("WALKING", final_walk))
    props = {"type": "SUBWAY", "totalTime": 600, "totalDistance": 1000, "transfers": 0}
    route, = parse_public_transit_routes({"status": "OK", "routes": [{"properties": props, "steps": steps}]})
    assert route.exit == expected


def test_subway_step_is_written_like_the_kakao_guidance():
    step = one(SUBWAY_PATH).steps[1]
    assert step == TransitStep(type="SUBWAY", guidance="수도권 3호선 (종로3가 > 동대입구)", duration_seconds=360, distance_meters=4200,
                               stop_names=["종로3가", "을지로3가", "충무로", "동대입구"], vehicle_names=["수도권 3호선"], line_id="seoul-3")


def test_bus_step_starts_with_the_type_word_and_lists_unique_numbers():
    step = one(BUS_PATH).steps[1]
    assert step.type == "BUS"
    assert step.vehicle_names == ["273", "271"]
    assert step.bus_type == "TRUNK"
    assert step.guidance == "간선 273외 1대 (종로3가.탑골공원 > 동대입구역.장충동)"
    assert step.stop_names == ["종로3가.탑골공원", "종로4가.종묘", "동대입구역.장충동"]
    assert step.duration_seconds == 1200


def test_bus_type_words_follow_the_odsay_table():
    def word(kind):
        return one(path(2, 10, 1, 0, [bus([("1", kind)], "a", "b", 5)])).steps[0].guidance.split(" ")[0]

    assert {kind: word(kind) for kind in (1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 26)} == {
        1: "일반", 2: "좌석", 3: "마을", 4: "직행", 5: "공항", 11: "간선", 12: "지선", 13: "순환", 14: "광역", 15: "버스", 26: "버스"}


def test_walks_keep_minutes_and_zero_walks_are_dropped():
    assert one(SUBWAY_PATH).steps[0] == TransitStep(type="WALKING", guidance="", duration_seconds=180, distance_meters=200,
                                                    stop_names=[], vehicle_names=[])
    assert [step.type for step in one(MIXED_PATH).steps] == ["WALKING", "BUS", "SUBWAY", "WALKING"]


def test_walk_between_two_rides_is_marked_as_a_transfer():
    steps = one(WALK_TRANSFER_PATH).steps
    assert [step.type for step in steps] == ["WALKING", "BUS", "WALKING", "SUBWAY", "WALKING"]
    assert [step.guidance for step in steps if step.type == "WALKING"] == ["", "환승", ""]


def test_transfers_are_rides_minus_one():
    assert [one(p).transfers for p in (SUBWAY_PATH, BUS_PATH, MIXED_PATH)] == [0, 0, 1]
    assert one(MIXED_PATH).type == "BUS_AND_SUBWAY"


def test_no_route_errors_and_intercity_results_give_an_empty_list():
    for code in ("-98", "-99", "3", "4", "5", "6"):
        assert parse_odsay_routes({"error": {"code": code, "msg": "x"}}) == []
    assert parse_odsay_routes(result(SUBWAY_PATH, search_type=1)) == []
    assert parse_odsay_routes(result()) == []


def test_other_errors_raise_upstream_in_both_shapes():
    with pytest.raises(OdsayError) as e:
        parse_odsay_routes({"error": [{"code": "500", "message": "[ApiKeyAuthFailed] ApiKey authentication failed."}]})
    assert e.value.code == "UPSTREAM" and "500" in str(e.value)
    with pytest.raises(OdsayError):
        parse_odsay_routes({"error": {"code": "-8", "msg": "필수 입력값 형식 및 범위 오류"}})
    with pytest.raises(OdsayError):
        parse_odsay_routes(["not", "a", "dict"])


class FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


HERE_TO_THERE = {"start_latitude": 37.5704, "start_longitude": 126.9918, "end_latitude": 37.5591, "end_longitude": 127.0053}


def test_fetch_sends_longitude_as_x_and_parses_the_answer():
    seen = {}

    def opener(url, timeout):
        seen["url"], seen["timeout"] = url, timeout
        return FakeResponse(json.dumps(result(SUBWAY_PATH)).encode("utf-8"))

    routes = fetch_odsay_routes(**HERE_TO_THERE, key="test-key", opener=opener)
    assert len(routes) == 1 and routes[0].steps[1].vehicle_names == ["수도권 3호선"]
    assert seen["url"].startswith("https://api.odsay.com/v1/api/searchPubTransPathT?")
    for part in ("SX=126.9918", "SY=37.5704", "EX=127.0053", "EY=37.5591", "apiKey=test-key"):
        assert part in seen["url"]


def test_fetch_without_a_key_does_not_call_odsay():
    def opener(url, timeout):
        raise AssertionError("must not be called")

    with pytest.raises(OdsayError) as e:
        fetch_odsay_routes(**HERE_TO_THERE, key="", opener=opener)
    assert e.value.code == "NOT_CONFIGURED"


def test_fetch_failures_do_not_leak_the_key():
    def http_error(url, timeout):
        raise urllib.error.HTTPError(url, 500, "Server Error", None, None)

    def unreachable(url, timeout):
        raise urllib.error.URLError("no route to host")

    for opener in (http_error, unreachable):
        with pytest.raises(OdsayError) as e:
            fetch_odsay_routes(**HERE_TO_THERE, key="secret-key", opener=opener)
        assert e.value.code == "UPSTREAM"
        assert "secret-key" not in str(e.value)


def test_daily_limit_counts_per_korean_day():
    limit = DailyLimit(2)
    day1 = datetime.datetime(2026, 11, 22, 3, 0, tzinfo=datetime.timezone.utc)        # 한국 11월 22일 12:00
    late = datetime.datetime(2026, 11, 22, 14, 59, tzinfo=datetime.timezone.utc)      # 한국 11월 22일 23:59
    day2 = datetime.datetime(2026, 11, 22, 15, 0, tzinfo=datetime.timezone.utc)       # 한국 11월 23일 00:00
    assert kst_today(day1) == "2026-11-22" and kst_today(day2) == "2026-11-23"
    assert [limit.take(day1), limit.take(late), limit.take(late)] == [True, True, False]
    assert (limit.used(late), limit.left(late)) == (2, 0)
    assert (limit.used(day2), limit.left(day2)) == (0, 2)
    assert limit.take(day2) is True


# ---------------------------------------------------------------- 카카오맵 실패 시 백업으로 넘어가기
KAKAO_ROUTE = TransitRoute(type="SUBWAY", duration_seconds=600, distance_meters=3000, transfers=0, steps=[])
ODSAY_ROUTE = TransitRoute(type="BUS", duration_seconds=900, distance_meters=4000, transfers=0, steps=[])


def backup_with(monkeypatch, key="k", limit=30, fetch=None):
    if key:
        monkeypatch.setenv("ODSAY_API_KEY", key)
    else:
        monkeypatch.delenv("ODSAY_API_KEY", raising=False)
    calls = []

    def default_fetch(**coordinates):
        calls.append(coordinates)
        return [ODSAY_ROUTE]

    return Backup(DailyLimit(limit), fetch or default_fetch), calls


def kakao_fails():
    raise RuntimeError("kakao is down")


def test_auto_uses_kakao_and_does_not_touch_the_backup(monkeypatch):
    backup, calls = backup_with(monkeypatch)
    assert find_routes("auto", lambda: [KAKAO_ROUTE], backup, **HERE_TO_THERE) == ([KAKAO_ROUTE], "KAKAO")
    assert find_routes("auto", lambda: [], backup, **HERE_TO_THERE) == ([], "KAKAO")     # 경로 없음은 실패가 아니다
    assert calls == [] and backup.limit.used() == 0


def test_auto_falls_back_to_odsay_when_kakao_fails(monkeypatch):
    backup, calls = backup_with(monkeypatch)
    assert find_routes("auto", kakao_fails, backup, **HERE_TO_THERE) == ([ODSAY_ROUTE], "ODSAY")
    assert calls == [HERE_TO_THERE] and backup.limit.used() == 1


def test_auto_raises_the_kakao_error_when_the_backup_cannot_help(monkeypatch):
    no_key, calls = backup_with(monkeypatch, key="")
    with pytest.raises(RuntimeError, match="kakao is down"):
        find_routes("auto", kakao_fails, no_key, **HERE_TO_THERE)
    assert calls == []

    used_up, calls = backup_with(monkeypatch, limit=0)
    with pytest.raises(RuntimeError, match="kakao is down"):
        find_routes("auto", kakao_fails, used_up, **HERE_TO_THERE)
    assert calls == []

    def odsay_fails(**coordinates):
        raise OdsayError("UPSTREAM", "ODsay HTTP 500")

    broken, _ = backup_with(monkeypatch, fetch=odsay_fails)
    with pytest.raises(RuntimeError, match="kakao is down"):
        find_routes("auto", kakao_fails, broken, **HERE_TO_THERE)


def test_kakao_only_never_calls_the_backup(monkeypatch):
    backup, calls = backup_with(monkeypatch)
    with pytest.raises(RuntimeError):
        find_routes("kakao", kakao_fails, backup, **HERE_TO_THERE)
    assert calls == []


def test_odsay_only_skips_kakao_and_reports_why_it_failed(monkeypatch):
    backup, calls = backup_with(monkeypatch)
    assert find_routes("odsay", kakao_fails, backup, **HERE_TO_THERE) == ([ODSAY_ROUTE], "ODSAY")
    assert len(calls) == 1

    no_key, _ = backup_with(monkeypatch, key="")
    with pytest.raises(OdsayError) as e:
        find_routes("odsay", lambda: [KAKAO_ROUTE], no_key, **HERE_TO_THERE)
    assert e.value.code == "NOT_CONFIGURED"

    used_up, _ = backup_with(monkeypatch, limit=0)
    with pytest.raises(OdsayError) as e:
        find_routes("odsay", lambda: [KAKAO_ROUTE], used_up, **HERE_TO_THERE)
    assert e.value.code == "LIMIT"


def test_backup_status_shows_the_count_but_never_the_key(monkeypatch):
    backup, _ = backup_with(monkeypatch, key="secret-key", limit=30)
    backup.routes(**HERE_TO_THERE)
    assert backup.status() == {"configured": True, "used_today": 1, "daily_limit": 30}
    assert "secret-key" not in json.dumps(backup.status())
    no_key, _ = backup_with(monkeypatch, key="")
    assert no_key.status()["configured"] is False and no_key.ready() is False


def test_usage_counter_counts_without_blocking_and_resets_each_day():
    """카카오맵은 막지 않고 세기만 한다 (한도를 넘어도 센다). 날짜가 바뀌면 0 부터."""
    usage = DailyLimit(2)
    day1 = datetime.datetime(2026, 11, 22, 3, 0, tzinfo=datetime.timezone.utc)
    day2 = datetime.datetime(2026, 11, 22, 15, 0, tzinfo=datetime.timezone.utc)
    assert [usage.add(day1), usage.add(day1), usage.add(day1)] == [1, 2, 3]
    assert (usage.used(day1), usage.left(day1)) == (3, 0)
    assert usage.add(day2) == 1
    status = usage_status(True, DailyLimit(1000))
    assert status == {"configured": True, "used_today": 0, "daily_limit": 1000}
