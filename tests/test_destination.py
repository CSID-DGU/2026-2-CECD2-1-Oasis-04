"""목적지 정확 일치 찾기 테스트 (tests/fixtures 로 만든 작은 지식베이스, 모델 없이 돈다)."""
from destination import exact_candidates, outside_region
from search import TransitKB


def names(cands):
    return [c["name"] for c in cands]


def test_exact_name_and_particles(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    got = exact_candidates("선릉역 가려는데요", kb)
    assert names(got)[0].startswith("선릉")
    # 표본에는 '선릉역' 버스 정류장도 있다. 이름이 같으면 지하철역이 먼저 온다
    assert got[0]["poi_type"] == "SUBWAY_STATION" and any(c["poi_type"] == "BUS_STOP" for c in got)
    assert got[0]["score"] >= max(c["score"] for c in got)
    assert names(exact_candidates("청량리로 가 주세요", kb))[0].startswith("청량리")
    assert names(exact_candidates("종로 삼가 가려는데요", kb))[0] == "종로3가"       # 숫자 읽기 정규화


def test_old_name_resolves_through_alias(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    got = exact_candidates("당고개 가려고요", kb)      # kb/data/extra_aliases.csv: 불암산 ← 당고개
    assert got and got[0]["name"] == "불암산" and got[0]["matched"] == "당고개"


def test_station_wins_over_incidental_words(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    got = exact_candidates("아이고 다리 아파 죽겠네 선릉 좀 갑시다", kb)
    assert got and got[0]["name"].startswith("선릉")
    assert all(c["poi_type"] == "SUBWAY_STATION" or c["name"].startswith("선릉") for c in got)


def test_generic_words_and_unknown_places_give_nothing(kb_dir):
    kb = TransitKB(kb_dir, use_embedding=False)
    assert exact_candidates("병원 가려는데요", kb) == []
    assert exact_candidates("네 맞아요", kb) == []
    assert exact_candidates("대전시청 가려는데요", kb) == []


def test_outside_region():
    assert outside_region("대전시청 가려는데요") == "대전"
    assert outside_region("부산역 가는 길 알려 주세요") == "부산"
    assert outside_region("세종문화회관 가려는데요") is None      # 서울에서 쓰는 이름과 겹치는 지역은 보지 않는다
    assert outside_region("분당선 타려면 어디로 가요") is None
    assert outside_region("선릉역 가려는데요") is None


def test_number_question_asks_which_ga(kb_dir):
    from destination import apply_context, number_question

    kb = TransitKB(kb_dir, use_embedding=False)
    q = number_question("종로 가려는데요", kb, (126.9918, 37.5704))
    assert q["ask"]["type"] == "NUMBER" and q["ask"]["stem"] == "종로" and q["ask"]["numbers"] == [3, 5]
    assert q["ask"]["text"].startswith("종로 몇 가로 가세요?")
    assert names(q["candidates"]) == ["종로3가", "종로5가"]          # 가까운 순
    # 번호까지 말했으면 묻지 않는다 (정확 일치가 먼저 잡는다)
    assert number_question("종로 삼가 가려는데요", kb) is None or names(exact_candidates("종로 삼가 가려는데요", kb))[0] == "종로3가"
    assert number_question("선릉역 가려는데요", kb) is None
    # 되묻기에 대한 짧은 답을 줄기와 합친다
    assert apply_context("삼가요", q["ask"]) == "종로3가"
    assert apply_context("5가", q["ask"]) == "종로5가"
    assert apply_context("선릉역 갈게요", q["ask"]) == "선릉역 갈게요"
    assert apply_context("삼가요", None) == "삼가요"
    assert names(exact_candidates(apply_context("오가요", q["ask"]), kb))[0] == "종로5가"


def test_choice_text_particles():
    from destination import choice_text

    assert choice_text(["시청역", "서울시청 정류장"]) == "시청역과 서울시청 정류장 중 어디로 가세요?"
    assert choice_text(["교대", "강남"]) == "교대와 강남 중 어디로 가세요?"
    assert choice_text(["가", "나", "다"]).startswith("다음 중 어디로 가세요?")
