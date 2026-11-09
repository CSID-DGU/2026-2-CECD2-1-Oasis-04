import pytest

from intent import classify, confirm_text
from text_norm import normalize_for_cer, normalize_for_training


def test_normalize_for_training_keeps_punct_collapses_space():
    assert normalize_for_training("  구 호선은  배차 시간이 긴가? ") == "구 호선은 배차 시간이 긴가?"


def test_normalize_for_cer_removes_punct_and_space():
    assert normalize_for_cer("선릉역까지 갈 때 많이 걸어야 합니까?") == "선릉역까지갈때많이걸어야합니까"
    assert normalize_for_cer("선릉역까지 갈 때?", keep_space=True) == "선릉역까지 갈 때"


@pytest.mark.parametrize("text,expected", [
    ("응", "AFFIRM"), ("네 맞아요", "AFFIRM"), ("그래", "AFFIRM"),
    ("아니요", "DENY"), ("아니 그거 말고", "DENY"),
    ("그만", "CANCEL"), ("됐어 처음으로", "CANCEL"),
    ("뭐라고요?", "REPEAT"), ("다시 말해 줘", "REPEAT"),
    ("선릉역 가려면 어떻게 가?", "NAVIGATE"), ("이거 청량리 가요?", "NAVIGATE"),
    ("오늘 날씨 어때", "UNKNOWN"),
])
def test_classify(text, expected):
    assert classify(text) == expected


def test_place_overrides_short_answer():
    assert classify("응 선릉역", has_place=True) == "NAVIGATE"
    assert classify("경동시장", has_place=True) == "NAVIGATE"


def test_confirm_text_josa():
    assert confirm_text("선릉역") == "선릉역으로 가시는 게 맞으세요?"
    assert confirm_text("경동시장앞 정류장") == "경동시장앞 정류장으로 가시는 게 맞으세요?"
    assert confirm_text("청량리") == "청량리로 가시는 게 맞으세요?"
    assert confirm_text("서울") == "서울로 가시는 게 맞으세요?"   # ㄹ 받침은 '로'
