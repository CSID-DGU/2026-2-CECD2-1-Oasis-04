import json
import os
import sqlite3

from search import TransitKB

JONGNO = (126.9918, 37.5704)


def test_build_filters_to_seoul_and_writes_tables(kb_dir):
    meta = json.load(open(os.path.join(kb_dir, "meta.json"), encoding="utf-8"))
    assert meta["by_type"]["BUS_STOP"] == 8        # 인천·안동 정류장 제외
    assert meta["by_type"]["SUBWAY_STATION"] == 7  # 경기 용인 강남대 제외 (주소 기준)
    con = sqlite3.connect(os.path.join(kb_dir, "transit.db"))
    names = {r[0] for r in con.execute("SELECT name FROM transit_poi WHERE poi_type='SUBWAY_STATION'")}
    assert "강남대" not in names and "불암산" in names
    aliases = {r[0] for r in con.execute("SELECT alias FROM poi_alias WHERE poi_id LIKE 'SUB_0409%'")}
    assert {"당고개", "당고개역", "불암산역"} <= aliases  # 옛 이름 별칭표 적용


def test_seoul_file_merges_and_drops_cross_source_duplicates(kb_dir_merged):
    con = sqlite3.connect(os.path.join(kb_dir_merged, "transit.db"))
    rows = con.execute("SELECT poi_id, name FROM transit_poi WHERE poi_type='BUS_STOP'").fetchall()
    names = [r[1] for r in rows]
    # 서울시 파일 4개(선착장 제외) + 전국 파일 8개 중 겹치는 3개(경동시장앞, 선릉역 2곳) 제거 = 9
    assert len(rows) == 9
    assert "한강버스.잠실선착장" not in names
    assert {"청량리역환승센터", "서울숲입구"} <= set(names)
    assert names.count("경동시장앞") == 1 and names.count("선릉역") == 1
    ids = {r[0] for r in rows if r[1] in ("경동시장앞", "선릉역")}
    assert ids == {"BUS_105000101", "BUS_122000201"}   # 남은 쪽은 서울시 파일의 NODE_ID
    ars = con.execute("SELECT ars_id FROM transit_poi WHERE poi_id='BUS_105000101'").fetchone()[0]
    assert ars == "06210"


def test_national_station_list_holds_stations_outside_region(kb_dir):
    stations = set(json.load(open(os.path.join(kb_dir, "national_stations.json"), encoding="utf-8")))
    assert {"강남대", "강남대역"} <= stations      # 경기 용인 → 서울 지식베이스 밖
    assert "선릉역" not in stations and "선릉" not in stations


def test_nearest_lists_closest_stations_without_duplicate_names(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    rows = kb.nearest(JONGNO, poi_type="SUBWAY_STATION", limit=5)
    assert rows[0]["name"] == "종로3가" and rows[0]["distance_m"] < 300
    names = [r["name"] for r in rows]
    assert sum(n.startswith("선릉") for n in names) == 1       # 2호선 '선릉' 과 분당선 '선릉역' 은 한 번만
    assert [r["distance_m"] for r in rows] == sorted(r["distance_m"] for r in rows)


def test_exact_name_is_top(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    res = kb.search("경동시장", JONGNO, k=3)
    assert res and res[0]["name"] == "경동시장앞"
    assert res[0]["matched"] == "경동시장"


def test_misrecognition_finds_station(kb_dir):
    kb = TransitKB(kb_dir, weights=(0.8, 0.1, 0.1), geo_radius_m=20000, use_embedding=False)
    names = [r["name"] for r in kb.search("선능력", JONGNO, k=3)]
    assert any(n.startswith("선릉") for n in names), names
    names = [r["name"] for r in kb.search("잠시랑", JONGNO, k=3)]
    assert any("잠실" in n for n in names), names


def test_old_station_name_resolves_via_alias(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    res = kb.search("당고개", JONGNO, k=3)
    assert res[0]["name"] in ("불암산", "당고개입구오거리")
    assert any(r["name"] == "불암산" for r in res)


def test_dedup_same_name_and_type(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    res = kb.search("선릉역", JONGNO, k=5)
    keys = [(r["name"], r["poi_type"]) for r in res]
    assert len(keys) == len(set(keys))  # 상·하행 정류장 중복은 하나만


def test_results_carry_geo_distance(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    res = kb.search("종로3가", JONGNO, k=1)
    assert res[0]["distance_m"] is not None and res[0]["distance_m"] < 300
