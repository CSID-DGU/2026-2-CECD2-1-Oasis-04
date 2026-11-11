"""현재 위치(브라우저 GPS) → 출발지 결정 테스트. tests/fixtures 로 만든 작은 지식베이스를 쓴다."""
from origin import locate, place_label
from search import TransitKB

MARKET_STOP = (127.0383, 37.5786)      # 표본의 '경동시장앞' 정류장 (경도, 위도)
JONGNO3GA = (126.991847, 37.570406)    # 표본의 1호선 '종로3가' 역


def test_nearest_any_returns_closest_place_of_any_type(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    assert kb.nearest_any(MARKET_STOP)[0]["name"] == "경동시장앞"
    rows = kb.nearest_any(JONGNO3GA, limit=3)
    # 역이 0 m, 버스정류장 '종로3가.탑골공원(중)' 이 100 m 쯤. 종류가 달라도 거리순으로 섞여 나온다
    assert (rows[0]["poi_type"], rows[0]["name"], rows[0]["distance_m"]) == ("SUBWAY_STATION", "종로3가", 0)
    assert rows[1]["poi_type"] == "BUS_STOP" and rows[1]["name"].startswith("종로3가") and 50 < rows[1]["distance_m"] < 150
    assert [r["distance_m"] for r in rows] == sorted(r["distance_m"] for r in rows)


def test_position_at_a_stop_snaps_to_that_stop(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    got, why = locate(kb, MARKET_STOP[0] + 0.0002, MARKET_STOP[1], accuracy_m=20)     # 정류장에서 18 m
    assert why is None and got["source"] == "GPS" and got["snapped"] is True
    assert got["name"] == "경동시장앞 정류장" and (got["x"], got["y"]) == MARKET_STOP
    assert got["nearest"]["poi_type"] == "BUS_STOP" and got["nearest"]["distance_m"] < 30 and got["accuracy_m"] == 20

    station, _ = locate(kb, *JONGNO3GA)
    assert station["snapped"] and station["name"] == "종로3가역" and station["nearest"]["poi_type"] == "SUBWAY_STATION"


def test_position_away_from_stops_keeps_coordinates(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    x, y = MARKET_STOP[0], MARKET_STOP[1] + 0.0027       # 정류장에서 북쪽으로 300 m
    got, why = locate(kb, x, y, accuracy_m=30)
    assert why is None and got["snapped"] is False
    assert got["name"] == "경동시장앞 정류장 근처" and (got["x"], got["y"]) == (x, y)
    assert 250 < got["nearest"]["distance_m"] < 350

    # 정류장 바로 옆이어도 오차가 맞추는 거리보다 크면 '그곳에 있다' 고 단정하지 않는다
    rough, _ = locate(kb, *MARKET_STOP, accuracy_m=400)
    assert rough["snapped"] is False and rough["name"].endswith("근처") and (rough["x"], rough["y"]) == MARKET_STOP


def test_unusable_positions_are_rejected_with_a_reason(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    assert locate(kb, *MARKET_STOP, accuracy_m=5000) == (None, "LOW_ACCURACY")     # IP 주소로 추정한 위치 등
    assert locate(kb, 129.0756, 35.1796, accuracy_m=10) == (None, "OUT_OF_AREA")    # 부산: 지식베이스 범위 밖
    assert locate(kb, "abc", 37.5) == (None, "INVALID_POSITION")
    assert locate(kb, 200.0, 37.5) == (None, "INVALID_POSITION")
    assert locate(kb, float("nan"), 37.5) == (None, "INVALID_POSITION")


def test_place_label():
    assert place_label({"poi_type": "SUBWAY_STATION", "name": "청량리(서울시립대입구)"}) == "청량리역"
    assert place_label({"poi_type": "SUBWAY_STATION", "name": "선릉역"}) == "선릉역"
    assert place_label({"poi_type": "BUS_STOP", "name": "종로3가.탑골공원(중)"}) == "종로3가.탑골공원(중) 정류장"
