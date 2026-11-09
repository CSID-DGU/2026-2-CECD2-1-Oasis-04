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
