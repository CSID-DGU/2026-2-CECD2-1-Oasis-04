from normalize import make_aliases, normalize_name, to_jamo, to_phonetic
from rapidfuzz import fuzz


def test_normalize_name_strips_paren_space_punct():
    assert normalize_name("서울대학교병원(본관)") == "서울대학교병원"
    assert normalize_name(" 종로 3가 ") == "종로3가"
    assert normalize_name("청량리.청과물도매시장(중)") == "청량리청과물도매시장"


def test_normalize_korean_numerals_before_ga_hoseon():
    assert normalize_name("종로삼가") == "종로3가"
    assert normalize_name("종로 삼가역") == "종로3가역"
    assert normalize_name("을지로사가") == "을지로4가"
    assert normalize_name("사호선") == "4호선"
    assert normalize_name("이십일번") == "21번"
    assert normalize_name("이가 아파") == "이가아파"   # '가' 앞이라도 뒤에 한글이 이어지면 그대로
    assert normalize_name("삼성역") == "삼성역"


def test_aliases_for_subway_add_yeok_suffix():
    assert "선릉역" in make_aliases("선릉", "SUBWAY_STATION")
    # 괄호 부제는 표준형에서 빠지고, 역 접미사 변형이 별칭으로 붙는다
    assert normalize_name("청량리(서울시립대입구)") == "청량리"
    assert "청량리역" in make_aliases("청량리(서울시립대입구)", "SUBWAY_STATION")


def test_aliases_split_compound_bus_stop_names():
    al = make_aliases("청량리역.롯데백화점", "BUS_STOP")
    assert {"청량리", "청량리역", "롯데백화점"} <= al


def test_aliases_abbreviations():
    assert "서울대병원" in make_aliases("서울대학교병원", "FACILITY")
    assert "도곡초교" in make_aliases("도곡초등학교", "BUS_STOP")


def test_phonetic_key_brings_misrecognitions_closer():
    # 자모 비교보다 발음 키 비교에서 정답이 더 가까워야 한다
    for wrong, right in [("선능력", "선릉역"), ("단공기", "당고개")]:
        j = fuzz.ratio(to_jamo(wrong), to_jamo(right))
        p = fuzz.ratio(to_phonetic(wrong), to_phonetic(right))
        assert p >= j, (wrong, right, j, p)


def test_phonetic_key_merges_nasal_batchim_and_ae_e():
    assert to_phonetic("당") == to_phonetic("단")
    assert to_phonetic("개") == to_phonetic("게")
