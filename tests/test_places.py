"""설정에서 키오스크 위치를 직접 정할 때 쓰는 것: 번호·이름으로 역·정류장 찾기(TransitKB.find_places)와
고른 곳을 출발지로 만들기(origin.pinned). tests/fixtures 로 만든 작은 지식베이스를 쓴다.
"""
from origin import pinned, place_of
from search import TransitKB, place_number, station_number


def names(rows):
    return [(r["poi_type"], r["name"]) for r in rows]


def test_station_number_and_readable_numbers():
    assert station_number("SUB_0130_1호선") == "0130" and station_number("SUB_D007_신분당선") == "D007"
    assert station_number("BUS_100000002") == ""
    assert place_number({"poi_type": "SUBWAY_STATION", "poi_id": "SUB_0130_1호선"}) == "130"
    assert place_number({"poi_type": "SUBWAY_STATION", "poi_id": "SUB_D007_신분당선"}) == "D007"
    assert place_number({"poi_type": "BUS_STOP", "poi_id": "BUS_1", "ars_id": "01010"}) == "01-010"
    assert place_number({"poi_type": "BUS_STOP", "poi_id": "BUS_2", "ars_id": ""}) == ""


def test_find_by_station_number_with_or_without_leading_zero(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    assert names(kb.find_places("130")) == [("SUBWAY_STATION", "종로3가")]
    assert names(kb.find_places("0130")) == [("SUBWAY_STATION", "종로3가")]
    assert names(kb.find_places("1023")) == [("SUBWAY_STATION", "선릉역")]          # 코레일 구간의 역 번호


def test_find_by_stop_number_with_or_without_hyphen(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    assert names(kb.find_places("01010")) == [("BUS_STOP", "종로3가.탑골공원(중)")]
    assert names(kb.find_places("01-010")) == [("BUS_STOP", "종로3가.탑골공원(중)")]
    assert names(kb.find_places("1010")) == [("BUS_STOP", "종로3가.탑골공원(중)")]   # 앞의 0 을 빼고 적어도 찾는다
    assert kb.find_places("00000") == [] and kb.find_places("") == [] and kb.find_places("   ") == []


def test_five_digits_or_a_hyphen_means_a_stop_number_only(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    assert names(kb.find_places("1023")) == [("SUBWAY_STATION", "선릉역")]            # 네 자리: 역 번호로도 찾는다
    assert kb.find_places("01023") == [] and kb.find_places("01-023") == []           # 정류장 번호 01-023 은 표본에 없다
    assert names(kb.find_places("01-222")) == [("BUS_STOP", "창경궁.서울대학교병원")]


def test_find_by_name_lists_exact_match_and_stations_first(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    found = names(kb.find_places("종로3가"))
    assert found[0] == ("SUBWAY_STATION", "종로3가") and ("BUS_STOP", "종로3가.탑골공원(중)") in found
    assert names(kb.find_places("종로3가역"))[0] == ("SUBWAY_STATION", "종로3가")     # '역' 을 붙여 적어도 같다
    seolleung = names(kb.find_places("선릉"))
    assert seolleung[:2] == [("SUBWAY_STATION", "선릉"), ("SUBWAY_STATION", "선릉역")]  # 노선이 다른 같은 역이 둘 다 나온다
    assert ("BUS_STOP", "선릉역") in seolleung
    assert names(kb.find_places("탑골공원")) == [("BUS_STOP", "종로3가.탑골공원(중)")]
    assert kb.find_places("없는이름") == []
    assert len(kb.find_places("역", limit=3)) <= 3


def test_pinned_place_becomes_the_origin(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    station = kb.find_places("130")[0]
    origin = pinned(kb, station["poi_id"])
    assert origin["source"] == "MANUAL" and origin["snapped"] is True and origin["name"] == "종로3가역"
    assert (origin["x"], origin["y"]) == (station["x"], station["y"])
    assert origin["nearest"]["poi_id"] == station["poi_id"] and origin["nearest"]["distance_m"] == 0
    place = place_of(kb, origin["nearest"])                # 위치 응답의 place 로 그대로 이어진다
    assert place["type"] == "SUBWAY_STATION" and place["name"] == "종로3가역" and place["lines"][0]["label"] == "1"

    stop = pinned(kb, kb.find_places("01010")[0]["poi_id"])
    assert stop["name"] == "종로3가.탑골공원(중) 정류장" and stop["nearest"]["poi_type"] == "BUS_STOP"
    assert place_of(kb, stop["nearest"]) == {"type": "BUS_STOP", "name": "종로3가.탑골공원(중) 정류장", "buses": []}


def test_pinned_unknown_place_is_refused(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    assert pinned(kb, "SUB_9999_없는선") is None and pinned(kb, "") is None and pinned(kb, None) is None
