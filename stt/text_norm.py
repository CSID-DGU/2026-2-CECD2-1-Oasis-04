"""전사 텍스트 정규화.

- normalize_for_training: Whisper 학습 목표 문장. 구두점은 남기고 공백·유니코드만 정리한다.
- normalize_for_cer: CER 계산용. 구두점 제거, 기본은 공백까지 제거(계획서 "공백 제거 기준 CER").
"""
import re
import unicodedata

_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^\w\s]", re.UNICODE)  # 한글·영문·숫자·공백 외 전부 제거


def normalize_for_training(text: str) -> str:
    t = unicodedata.normalize("NFC", text or "")
    t = _WS.sub(" ", t).strip()
    return t


def normalize_for_cer(text: str, keep_space: bool = False) -> str:
    t = normalize_for_training(text)
    t = _PUNCT.sub("", t)
    t = _WS.sub(" ", t).strip()
    if not keep_space:
        t = t.replace(" ", "")
    return t


if __name__ == "__main__":
    for s in ["선릉역까지 갈 때 많이 걸어야 합니까?", "  구 호선은  배차 시간이 긴가? ", "육 호선 첫 차선 확인해 줘."]:
        print(repr(s), "->", repr(normalize_for_training(s)), "|", repr(normalize_for_cer(s)))
