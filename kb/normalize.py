"""정류장·역 이름 정규화, 별칭 생성, 한글 자모 분해.

- normalize_name: 검색 키용 표준형 (공백·괄호·특수문자 제거)
- make_aliases: 사람들이 실제로 부르는 변형들 (역 접미사, 괄호 제거, 점으로 이어진 이름 분리, 약칭)
- to_jamo: "선릉역" → "ㅅㅓㄴㄹㅡㅇㅇㅕㄱ" (편집거리 비교용. 받침 하나 차이도 가깝게 잡힌다)
"""
import re
import unicodedata

from jamo import h2j, j2hcj

_PAREN = re.compile(r"[\(\[（【][^\)\]）】]*[\)\]）】]")
_NONWORD = re.compile(r"[^0-9A-Za-z가-힣]")
_SPLIT = re.compile(r"[.·/,]")
# 음성 인식은 "종로삼가", "사호선" 처럼 한글 숫자로 적는 경우가 많다 → 표기를 숫자로 통일 (종로3가, 4호선)
_NUM = {"일": "1", "이": "2", "삼": "3", "사": "4", "오": "5", "육": "6", "칠": "7", "팔": "8", "구": "9", "십": "10"}
_KNUM = re.compile(r"(십[일이삼사오육칠팔구]|[일이삼사오육칠팔구]십[일이삼사오육칠팔구]?|[일이삼사오육칠팔구십])"
                   r"(?=(가|호선|번|동|리)(역|정류장|$|[^가-힣]))")


def _knum_to_digits(m: re.Match) -> str:
    s = m.group(1)
    if len(s) == 1:
        return _NUM[s]
    if s.startswith("십"):
        return str(10 + int(_NUM[s[1]]))
    tens = int(_NUM[s[0]]) * 10
    return str(tens + (int(_NUM[s[2]]) if len(s) == 3 else 0))

# 긴 이름 → 흔히 쓰는 약칭 (왼쪽이 포함되면 오른쪽으로 바꾼 별칭도 만든다)
_ABBREV = [
    ("대학교병원", "대병원"),
    ("대학교", "대"),
    ("초등학교", "초교"),
    ("초등학교", "초"),
    ("중학교", "중"),
    ("고등학교", "고"),
    ("주민센터", "동사무소"),
    ("사거리", "네거리"),
    ("아파트", "아파트앞"),
    ("버스터미널", "터미널"),
    ("종합운동장", "운동장"),
]


def normalize_name(name: str) -> str:
    s = unicodedata.normalize("NFC", name or "").strip()
    s = _PAREN.sub("", s)
    s = _NONWORD.sub("", s)
    s = _KNUM.sub(_knum_to_digits, s)
    return s


def to_jamo(name: str) -> str:
    return j2hcj(h2j(normalize_name(name)))


# 음성 인식 오류에서 자주 섞이는 소리끼리 같은 기호로 묶는다 (받침 비음 ㄴ/ㅇ/ㅁ, 모음 ㅐ/ㅔ, 격음·경음 등)
_PHON_MAP = str.maketrans({
    "ㅐ": "ㅔ", "ㅒ": "ㅖ", "ㅙ": "ㅞ", "ㅚ": "ㅞ", "ㅢ": "ㅣ",
    "ㄲ": "ㄱ", "ㅋ": "ㄱ", "ㄸ": "ㄷ", "ㅌ": "ㄷ", "ㅃ": "ㅂ", "ㅍ": "ㅂ", "ㅆ": "ㅅ", "ㅉ": "ㅈ", "ㅊ": "ㅈ",
    "ㅇ": "ㄴ", "ㅁ": "ㄴ",   # 받침 비음 (초성 ㅇ은 소리값이 없으므로 아래에서 따로 지움)
})


def to_phonetic(name: str) -> str:
    """소리 기준 근사 키. 초성 ㅇ(무음)은 지우고, 비슷한 소리는 한 기호로 합친다.
    예) 선능력 → ㅅㅓㄴㄴㅡㄴㄹㅕㄱ, 선릉역 → ㅅㅓㄴㄹㅡㄴㅕㄱ (편집거리가 자모보다 가까워진다)"""
    s = normalize_name(name)
    out = []
    for ch in s:
        if "가" <= ch <= "힣":
            code = ord(ch) - 0xAC00
            cho, jung, jong = code // 588, (code % 588) // 28, code % 28
            parts = []
            if cho != 11:  # ㅇ 초성은 무음
                parts.append("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"[cho])
            parts.append("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"[jung])
            if jong:
                parts.append(" ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"[jong][-1])
            out.append("".join(parts))
        else:
            out.append(ch)
    return "".join(out).translate(_PHON_MAP)


def make_aliases(name: str, poi_type: str) -> set[str]:
    """원래 이름을 제외한 별칭 집합. 모두 normalize_name 형태로 돌려준다."""
    out = set()
    raw = unicodedata.normalize("NFC", name or "").strip()
    base = normalize_name(raw)
    if not base:
        return out

    # 괄호 안 내용 (예: "서울역(1호선)" → "서울역", 괄호 안 "1호선"은 버림)
    no_paren = normalize_name(_PAREN.sub("", raw))
    if no_paren and no_paren != base:
        out.add(no_paren)

    # 점/가운뎃점/슬래시로 이어진 복합 이름 → 각 부분 (예: "○○아파트.○○초교")
    for part in _SPLIT.split(_PAREN.sub("", raw)):
        p = normalize_name(part)
        if p and p != base and len(p) >= 2:
            out.add(p)

    # 역 접미사: 지하철역은 "선릉" ↔ "선릉역" 둘 다, 버스정류장 "선릉역" → "선릉"
    cands = {base} | set(out)
    for c in list(cands):
        if c.endswith("역") and len(c) > 2:
            out.add(c[:-1])
        elif poi_type == "SUBWAY_STATION":
            out.add(c + "역")
    # 버스정류장 흔한 접미사 제거형: "○○앞", "○○입구", "○○정류장"
    for c in list(cands):
        for suf in ("정류장", "정류소", "입구", "앞"):
            if c.endswith(suf) and len(c) > len(suf) + 1:
                out.add(c[: -len(suf)])

    # 약칭
    for long, short in _ABBREV:
        for c in list(cands | out):
            if long in c:
                out.add(c.replace(long, short))

    out.discard(base)
    return {a for a in out if len(a) >= 2}


if __name__ == "__main__":
    for n, t in [("선릉", "SUBWAY_STATION"), ("서울대학교병원(본관)", "FACILITY"),
                 ("청량리역.롯데백화점", "BUS_STOP"), ("종로3가", "SUBWAY_STATION"), ("도곡초등학교앞", "BUS_STOP")]:
        print(n, "->", normalize_name(n), "|", to_jamo(n), "|", sorted(make_aliases(n, t)))
    from rapidfuzz import fuzz
    for q, tgt in [("선능력", "선릉역"), ("단공기", "당고개"), ("잠시랑", "잠실"), ("서울대병언", "서울대병원")]:
        print(f"{q}/{tgt}: jamo {fuzz.ratio(to_jamo(q), to_jamo(tgt)):.0f}  phonetic {fuzz.ratio(to_phonetic(q), to_phonetic(tgt)):.0f}  "
              f"[{to_phonetic(q)} | {to_phonetic(tgt)}]")
