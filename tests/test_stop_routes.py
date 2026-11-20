"""정류장에 서는 버스와 앞·다음 정류장 만들기(kb/stop_routes.py) 테스트.

손으로 만든 작은 노선으로 규칙을 하나씩 확인한다. 실제 자료(서울시버스노선별정류소정보)는 저장소에 없어서 쓰지 않는다.
"""
import json
import os
import subprocess
import sys

import pytest
from origin import fixed_place, pinned, place_of
from search import TransitKB
from stop_routes import build, bus_kind, bus_number, index_by_ars, read_routes, stop_at

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 정류장: (NODE_ID, 정류장 번호, 이름, 위도, 경도). 탑골공원은 tests/fixtures/bus_stops_sample.csv 의 '종로3가.탑골공원(중)' 과 같은 번호·자리다
JONGNO2 = ("100000001", "01001", "종로2가", 37.5701, 126.9860)
TAPGOL = ("100000010", "01010", "종로3가.탑골공원", 37.5712, 126.9915)
JONGNO4 = ("100000020", "01020", "종로4가.종묘", 37.5709, 126.9960)
NAKWON = ("100000030", "01030", "낙원상가", 37.5725, 126.9880)
CHANGDEOK = ("100000040", "01040", "창덕궁", 37.5790, 126.9910)
VIRTUAL = ("100000099", "01099", "세운교(가상)", 37.5705, 126.9940)


def route(route_id, name, *stops):
    return [{"route_id": route_id, "route": name, "seq": i + 1, "node": s[0], "ars": s[1], "name": s[2], "y": s[3], "x": s[4]}
            for i, s in enumerate(stops)]


ROWS = (route("1", "101", JONGNO2, TAPGOL, VIRTUAL, JONGNO4)
        + route("2", "260", JONGNO2, TAPGOL, JONGNO4)
        + route("3", "7212", NAKWON, TAPGOL, CHANGDEOK)
        + route("4", "N26", JONGNO2, TAPGOL, JONGNO4)
        + route("5", "110A고려대", JONGNO2, TAPGOL)
        + route("6", "종로01", TAPGOL, CHANGDEOK))


def test_bus_number_drops_the_direction_tail():
    assert bus_number("110A고려대") == "110A" and bus_number("5522B호암") == "5522B"
    assert bus_number("8442퇴근") == "8442" and bus_number("서울07출근") == "서울07"
    for same in ("101", "9401-1", "종로01", "성동03-2", "N6001", "01A", "한강버스(서부)", "청계A01"):
        assert bus_number(same) == same


@pytest.mark.parametrize("number, kind", [
    ("101", "TRUNK"), ("110A", "TRUNK"), ("7212", "BRANCH"), ("8442", "BRANCH"), ("0411", "BRANCH"), ("6211", "BRANCH"), ("6716", "BRANCH"),
    ("9401", "EXPRESS"), ("9401-1", "EXPRESS"), ("01A", "CIRCULAR"),
    ("종로01", "VILLAGE"), ("성동03-2", "VILLAGE"),
    ("N26", "NIGHT"), ("N6001", "NIGHT"), ("심야A21", "NIGHT"),
    ("6001", "AIRPORT"), ("6020", "AIRPORT"), ("6100-1", "AIRPORT"), ("6200", "AIRPORT"), ("6705A", "AIRPORT"),
    ("서울07", "OTHER"), ("청계A01", "OTHER"), ("한강버스(서부)", "OTHER"),
])
def test_bus_kind_follows_the_number_shape(number, kind):
    assert bus_kind(number) == kind


def test_buses_are_grouped_by_kind_in_reading_order():
    table = build(ROWS)
    assert table[TAPGOL[0]]["buses"] == [
        {"kind": "TRUNK", "numbers": ["101", "110A", "260"]},
        {"kind": "BRANCH", "numbers": ["7212"]},
        {"kind": "VILLAGE", "numbers": ["종로01"]},
        {"kind": "NIGHT", "numbers": ["N26"]},
    ]
    assert table[TAPGOL[0]]["ars"] == "01010" and table[TAPGOL[0]]["name"] == "종로3가.탑골공원"


def test_prev_and_next_are_where_most_buses_come_from_and_go_to():
    table = build(ROWS)
    # 앞: 종로2가 4개 노선, 낙원상가 1개. 다음: 종로4가.종묘 3개, 창덕궁 2개
    assert (table[TAPGOL[0]]["prev"], table[TAPGOL[0]]["next"]) == ("종로2가", "종로4가.종묘")
    # 모든 노선이 여기서 출발하면 앞이 없고, 여기서 끝나면 다음이 없다
    assert table[JONGNO2[0]]["prev"] is None and table[JONGNO2[0]]["next"] == "종로3가.탑골공원"
    assert table[JONGNO4[0]]["next"] is None and table[CHANGDEOK[0]]["next"] is None


def test_virtual_points_are_skipped():
    table = build(ROWS)
    assert VIRTUAL[0] not in table
    assert table[JONGNO4[0]]["prev"] == "종로3가.탑골공원"       # 101 번은 '세운교(가상)' 을 건너뛰고 잇는다


def test_tie_is_broken_by_name_so_the_result_is_stable():
    rows = route("1", "101", ("1", "00001", "가", 37.0, 127.0), ("3", "00003", "다", 37.0, 127.02)) \
        + route("2", "102", ("2", "00002", "나", 37.0, 127.01), ("3", "00003", "다", 37.0, 127.02))
    assert build(rows)["3"]["prev"] == "가" and build(list(reversed(rows)))["3"]["prev"] == "가"


def test_stop_at_finds_by_poi_id_then_by_number_and_position():
    table = build(ROWS)
    by_ars = index_by_ars(table)
    direct = stop_at(table, "BUS_100000010")
    assert direct["prev"] == "종로2가" and direct["next"] == "종로4가.종묘" and direct["buses"][0]["kind"] == "TRUNK"
    # 다른 자료로 만든 정류장(poi_id 가 다르다)은 정류장 번호와 좌표로 찾는다
    assert stop_at(table, "BUS_GGB100000002", "01010", 37.5712, 126.9915, by_ars=by_ars) == direct
    assert stop_at(table, "BUS_GGB100000002", "01010", 37.45, 126.70, by_ars=by_ars) is None      # 번호만 같은 먼 곳
    assert stop_at(table, "BUS_GGB100000002", "01010", 37.5712, 126.9915) is None                  # 번호 표가 없으면 찾지 않는다
    assert stop_at(table, "BUS_없는곳", "99999", 37.57, 126.99, by_ars=by_ars) is None and stop_at({}, "BUS_100000010") is None
    direct["buses"][0]["numbers"].append("고침")                                                   # 돌려준 것을 고쳐도 표는 그대로다
    assert "고침" not in table[TAPGOL[0]]["buses"][0]["numbers"]


def write_csv(path, rows, header="ROUTE_ID,노선명,순번,NODE_ID,ARS_ID,정류소명,X좌표,Y좌표"):
    lines = [header] + [f"{r['route_id']},{r['route']},{r['seq']},{r['node']},{r['ars']},{r['name']},{r['x']},{r['y']}" for r in rows]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return str(path)


def test_read_routes_reads_csv_and_pads_stop_numbers(tmp_path):
    rows = route("1", "9409", ("206000465", "7832", "판교", 37.3673, 127.0711), JONGNO2)
    path = tmp_path / "routes.csv"
    write_csv(path, rows)
    with open(path, "a", encoding="utf-8") as f:
        f.write("1,9409,순번없음,1,00001,이상한줄,127.0,37.0\n")           # 순번이 숫자가 아닌 줄은 버린다
    got = read_routes(str(path))
    assert [(r["route"], r["seq"], r["ars"], r["name"]) for r in got] == [("9409", 1, "07832", "판교"), ("9409", 2, "01001", "종로2가")]
    assert (got[0]["x"], got[0]["y"]) == (127.0711, 37.3673)
    with pytest.raises(KeyError):
        read_routes(write_csv(tmp_path / "bad.csv", rows, header="ROUTE_ID,노선명,순번,NODE_ID,ARS_ID,이름,X좌표,Y좌표"))


# ---------------------------------------------------------------- 위치 응답의 place
def test_place_of_bus_stop_carries_buses_and_neighbours(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    kb.stop_routes = build(ROWS)
    kb.stops_by_ars = index_by_ars(kb.stop_routes)
    stop = kb.find_places("01010")[0]
    expected = {"type": "BUS_STOP", "name": "종로3가.탑골공원(중) 정류장", "prev": "종로2가", "next": "종로4가.종묘",
                "buses": [{"kind": "TRUNK", "numbers": ["101", "110A", "260"]}, {"kind": "BRANCH", "numbers": ["7212"]},
                          {"kind": "VILLAGE", "numbers": ["종로01"]}, {"kind": "NIGHT", "numbers": ["N26"]}]}
    assert place_of(kb, stop) == expected
    # 설정에서 고른 곳, 고정 위치로 찾은 곳도 같다 (nearest 에는 정류장 번호가 없어서 지식베이스에서 읽는다)
    assert place_of(kb, pinned(kb, stop["poi_id"])["nearest"]) == expected
    kiosk = {"name": "종로3가 정류장 키오스크", "x": 126.9915, "y": 37.5712, "place_type": "BUS_STOP"}
    assert place_of(kb, fixed_place(kb, kiosk)) == expected
    # 자료에 없는 정류장은 이름만
    other = kb.find_places("23444")[0]
    assert place_of(kb, other) == {"type": "BUS_STOP", "name": "도곡초등학교 정류장", "prev": None, "next": None, "buses": []}


def test_place_of_bus_stop_without_route_table(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)                 # 표본 지식베이스에는 stop_routes.json 이 없다
    assert kb.stop_routes == {} and kb.stops_by_ars == {}
    stop = kb.find_places("01010")[0]
    assert place_of(kb, stop) == {"type": "BUS_STOP", "name": "종로3가.탑골공원(중) 정류장", "prev": None, "next": None, "buses": []}


def test_build_kb_writes_the_route_table(tmp_path):
    routes = write_csv(tmp_path / "routes.csv", ROWS)
    out = tmp_path / "kb"
    subprocess.run([sys.executable, os.path.join(ROOT, "kb", "build_kb.py"),
                    "--bus", os.path.join(ROOT, "tests", "fixtures", "bus_stops_sample.csv"),
                    "--subway", os.path.join(ROOT, "tests", "fixtures", "subway_stations_sample.csv"),
                    "--bus-routes", routes, "--regions", "서울", "--out", str(out), "--no-embedding"], check=True, capture_output=True)
    meta = json.loads((out / "meta.json").read_text(encoding="utf-8"))
    assert meta["stop_routes"] == 5 and meta["sources"]["bus_routes"] == routes
    kb = TransitKB(str(out), use_embedding=False)
    place = place_of(kb, kb.find_places("01010")[0])
    assert (place["prev"], place["next"]) == ("종로2가", "종로4가.종묘") and place["buses"][0] == {"kind": "TRUNK", "numbers": ["101", "110A", "260"]}
