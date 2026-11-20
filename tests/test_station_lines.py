"""역의 노선과 앞·다음 역 만들기(kb/station_lines.py) 테스트.

앞부분은 손으로 만든 작은 노선으로 규칙을 하나씩 확인하고, 뒷부분은 저장소의 실제 자료
(server/data/서울시 역사마스터 정보.csv)로 서울의 잘 알려진 역들이 맞게 나오는지 본다.
"""
import os

import pytest
from origin import fixed_place, place_of
from search import TransitKB
from station_lines import build, connect, group_by_line, lines_at, read_master, station_key

MASTER = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server", "data", "서울시 역사마스터 정보.csv")


def row(station_id, name, track, lat, lon=127.0):
    return {"id": station_id, "name": name, "track": track, "lat": lat, "lon": lon}


def at(table, name):
    """{표지: (앞, 다음)}"""
    return {e["label"]: (e["prev"], e["next"]) for e in table[station_key(name)]}


def test_station_key_drops_brackets_and_trailing_yeok():
    assert station_key("종로3가(탑골공원)") == "종로3가"
    assert station_key("서울역") == "서울" and station_key("서울역(경의선)") == "서울"
    assert station_key("역삼") == "역삼" and station_key("신촌역") == "신촌"


def test_numbered_stations_are_chained_and_ends_have_no_neighbour():
    # 위도 0.01 도 ≈ 1.1 km. 번호가 선로 순서인 9호선 네 역
    table = build([row("4101", "가", "9호선", 37.50), row("4102", "나", "9호선", 37.51),
                   row("4103", "다(부기)", "9호선", 37.52), row("4104", "라", "9호선", 37.53)])
    assert at(table, "가") == {"9": (None, "나")}
    assert at(table, "나") == {"9": ("가", "다")}          # 화면에 적는 이름은 괄호 부기를 뗀다
    assert at(table, "라") == {"9": ("다", None)}


def test_station_added_later_is_moved_between_its_real_neighbours():
    # '마' 는 나중에 생겨 번호가 맨 끝(4105)이지만 실제로는 '나' 와 '다' 사이에 있다 (동묘앞·남위례와 같은 경우)
    table = build([row("4101", "가", "9호선", 37.50), row("4102", "나", "9호선", 37.51), row("4103", "다", "9호선", 37.53),
                   row("4104", "라", "9호선", 37.54), row("4105", "마", "9호선", 37.52)])
    assert at(table, "마") == {"9": ("나", "다")}
    assert at(table, "나") == {"9": ("가", "마")} and at(table, "다") == {"9": ("마", "라")}
    assert at(table, "라") == {"9": ("다", None)}          # 원래 끝 역은 그대로 종점이다


def test_branch_shows_the_longer_side_and_the_short_branch_ends():
    # 본선 가-나-다-라-마 (5호선 번호 순), '다' 에서 짧은 지선 바-사 가 갈라진다 (번호가 멀리 떨어져 있다)
    rows = [row(f"25{10 + i}", n, "5호선", 37.50 + 0.01 * i) for i, n in enumerate(["가", "나", "다", "라", "마"])]
    rows += [row("2560", "바", "5호선", 37.52, 127.012), row("2561", "사", "5호선", 37.52, 127.024)]
    table = build(rows)
    assert at(table, "다") == {"5": ("나", "라")}          # 갈림길에서는 뒤로 이어진 역이 많은 두 쪽
    assert at(table, "바") == {"5": ("다", "사")} and at(table, "사") == {"5": ("바", None)}


def test_tracks_of_one_service_are_joined_and_shared_stations_get_both_lines():
    # 1호선(서울교통공사 구간)과 경부선(코레일 구간)은 같은 운행 노선이다. 경부선 용산에는 경의중앙선도 선다
    table = build([row("0150", "서울역", "1호선", 37.555), row("0151", "시청", "1호선", 37.565),
                   row("1002", "남영", "경부선", 37.541), row("1003", "용산", "경부선", 37.530),
                   row("1010", "이촌", "경원선", 37.522, 127.01), row("1261", "효창공원앞", "경의중앙선", 37.539, 126.985)])
    assert at(table, "서울역")["1"] == ("남영", "시청")
    assert at(table, "용산") == {"1": (None, "남영"), "경의중앙": ("이촌", "효창공원앞")}
    assert set(at(table, "이촌")) == {"경의중앙"}          # 경원선 이촌에는 1호선이 서지 않는다


def test_lines_at_ignores_a_different_station_with_the_same_name():
    table = {"신촌": [{"lineId": "seoul-2", "label": "2", "prev": "홍대입구", "next": "이대", "lat": 37.5551, "lon": 126.9369},
                      {"lineId": "gyeongui-jungang", "label": "경의중앙", "prev": "가좌", "next": "서울역", "lat": 37.5598, "lon": 126.9423}]}
    assert [e["label"] for e in lines_at(table, "신촌역", 37.5551, 126.9369)] == ["2"]
    assert [e["label"] for e in lines_at(table, "신촌(경의중앙선)", 37.5598, 126.9423)] == ["경의중앙"]
    assert lines_at(table, "없는역", 37.5, 127.0) == []
    assert set(lines_at(table, "신촌", 37.5551, 126.9369)[0]) == {"lineId", "label", "prev", "next"}      # 좌표는 내보내지 않는다


# ---------------------------------------------------------------- 실제 자료
@pytest.fixture(scope="module")
def seoul():
    if not os.path.exists(MASTER):
        pytest.skip("서울시 역사마스터 정보.csv 가 없다")
    return read_master(MASTER)


def test_real_data_known_transfer_stations(seoul):
    table = build(seoul)
    assert at(table, "종로3가") == {"1": ("종각", "종로5가"), "3": ("안국", "을지로3가"), "5": ("광화문", "을지로4가")}
    assert at(table, "충무로") == {"3": ("을지로3가", "동대입구"), "4": ("동대문역사문화공원", "명동")}
    seoul_station = at(table, "서울역")
    assert seoul_station["1"] == ("남영", "시청") and seoul_station["4"] == ("회현", "숙대입구")
    assert seoul_station["공항철도"] == (None, "공덕") and set(seoul_station["경의중앙"]) == {None, "신촌"}
    wangsimni = at(table, "왕십리")
    assert set(wangsimni) == {"2", "5", "경의중앙", "수인분당"}
    assert wangsimni["2"] == ("상왕십리", "한양대") and set(wangsimni["수인분당"]) == {"청량리", "서울숲"}


def test_real_data_loop_branches_and_late_stations(seoul):
    table = build(seoul)
    assert at(table, "시청")["2"] == ("충정로", "을지로입구") and at(table, "충정로")["2"] == ("아현", "시청")      # 순환선이 이어진다
    assert at(table, "성수")["2"] == ("뚝섬", "건대입구")                    # 성수지선이 갈라지는 역: 본선 쪽을 보인다
    assert set(at(table, "용답")["2"]) == {"성수", "신답"}
    assert set(at(table, "구로")["1"]) == {"신도림", "가산디지털단지"}        # 구일(인천 방면)보다 긴 쪽
    assert set(at(table, "금천구청")["1"]) == {"독산", "석수"}               # 광명 셔틀 지선은 나오지 않는다
    assert at(table, "동묘앞")["1"] == ("동대문", "신설동")                  # 나중에 생긴 역
    assert at(table, "남위례")["8"] == ("복정", "산성") and at(table, "모란")["8"] == ("수진", None)
    assert at(table, "둔촌동")["5"] == ("강동", "올림픽공원")                # 마천 방면 지선


def test_real_data_line_ends_and_forks(seoul):
    lines = group_by_line(seoul)

    def ends_and_forks(line_id):
        near = connect(line_id, lines[line_id])
        name = lambda k: lines[line_id][k]["name"]  # noqa: E731
        return ({name(k) for k in near if len(near[k]) == 1}, {name(k) for k in near if len(near[k]) >= 3})

    assert ends_and_forks("seoul-1") == ({"광명", "신창", "연천", "인천"}, {"구로", "금천구청"})
    assert ends_and_forks("seoul-2") == ({"까치산", "신설동"}, {"성수", "신도림"})
    assert ends_and_forks("seoul-3") == ({"대화", "오금"}, set())
    assert ends_and_forks("seoul-5") == ({"마천", "방화", "하남검단산"}, {"강동"})
    assert ends_and_forks("seoul-6") == ({"신내"}, {"응암"})
    assert ends_and_forks("gyeongui-jungang") == ({"서울역", "임진강", "지평"}, {"가좌"})
    assert ends_and_forks("suin-bundang") == ({"인천", "청량리"}, set())


def test_real_data_same_name_different_station(seoul):
    table = build(seoul)
    line2 = next(e for e in table["신촌"] if e["lineId"] == "seoul-2")
    assert [e["label"] for e in lines_at(table, "신촌", line2["lat"], line2["lon"])] == ["2"]
    jungang = next(e for e in table["신촌"] if e["lineId"] == "gyeongui-jungang")
    assert [e["label"] for e in lines_at(table, "신촌", jungang["lat"], jungang["lon"])] == ["경의중앙"]
    seoul1 = next(e for e in table["서울"] if e["lineId"] == "seoul-1")      # 서울역은 승강장이 떨어져 있어도 한 역이다
    assert [e["label"] for e in lines_at(table, "서울역", seoul1["lat"], seoul1["lon"])] == ["1", "4", "GTX-A", "경의중앙", "공항철도"]


# ---------------------------------------------------------------- 위치 응답의 place
def test_place_of_and_fixed_place(kb_dir, seoul):
    kb = TransitKB(kb_dir, use_embedding=False)
    kb.station_lines = build(seoul)
    jongno = {"name": "종로3가역 키오스크", "x": 126.9918, "y": 37.5704, "place_type": "SUBWAY_STATION"}
    place = place_of(kb, fixed_place(kb, jongno))
    assert place["type"] == "SUBWAY_STATION" and place["name"] == "종로3가역"
    assert [(e["lineId"], e["label"]) for e in place["lines"]] == [("seoul-1", "1"), ("seoul-3", "3"), ("seoul-5", "5")]
    assert place["lines"][0] == {"lineId": "seoul-1", "label": "1", "prev": "종각", "next": "종로5가"}

    # 같은 자리라도 정류장에 놓인 키오스크면 정류장이 나온다. 서는 버스 번호는 자료가 없어 빈 목록이다
    stop = place_of(kb, fixed_place(kb, {**jongno, "place_type": "BUS_STOP"}))
    assert stop["type"] == "BUS_STOP" and stop["name"].startswith("종로3가") and stop["name"].endswith("정류장") and stop["buses"] == []

    # place_type 이 없으면 키오스크 이름으로 짐작한다. 가까운 곳에 그런 장소가 없으면 None
    assert fixed_place(kb, {"name": "종로3가역 키오스크", "x": 126.9918, "y": 37.5704})["poi_type"] == "SUBWAY_STATION"
    assert fixed_place(kb, {"name": "산속 키오스크", "x": 127.2, "y": 37.9}) is None
    assert place_of(kb, None) is None


def test_knowledge_base_build_includes_the_line_table(kb_dir):
    # build_kb.py 가 저장소의 역사마스터 자료로 station_lines.json 도 함께 만든다 → 지식베이스를 열면 바로 쓸 수 있다
    kb = TransitKB(kb_dir, use_embedding=False)
    place = place_of(kb, {"name": "종로3가", "poi_type": "SUBWAY_STATION", "x": 126.991847, "y": 37.570406})
    assert place["name"] == "종로3가역" and [e["label"] for e in place["lines"]] == ["1", "3", "5"]


def test_place_of_without_line_table_gives_empty_lines(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    kb.station_lines = {}                              # 예전에 만든 지식베이스처럼 station_lines.json 이 없는 경우
    place = place_of(kb, {"name": "종로3가", "poi_type": "SUBWAY_STATION", "x": 126.991847, "y": 37.570406})
    assert place == {"type": "SUBWAY_STATION", "name": "종로3가역", "lines": []}
