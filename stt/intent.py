"""규칙 기반 의도 분류 (API 명세 2.6절 intent) + 확인 문장 생성.

MVP 는 규칙·키워드 사전으로 간다 (계획서 5.3절). 필요해지면 경량 분류 모델로 교체.
"""
import re

from text_norm import normalize_for_training

_AFFIRM = ["네", "예", "응", "어", "맞아", "맞습니다", "맞아요", "맞네", "그래", "그렇지", "좋아", "좋습니다", "오케이", "옳지", "그려", "맞다"]
_DENY = ["아니", "아니요", "아니야", "아닌데", "아뇨", "틀려", "틀렸", "그거 말고", "거기 말고", "다른 데", "아이다", "아입니다"]
_CANCEL = ["그만", "됐어", "됐다", "취소", "처음으로", "안 해", "안할래", "나갈래", "관둬", "끝", "고만"]
_REPEAT = ["다시", "뭐라고", "뭐라꼬", "못 들었", "한 번 더", "한번 더", "다시 말해", "다시 말씀", "잘 안 들려", "안 들려"]
_NAVIGATE = re.compile(r"(가요|가나요|갑니까|가니|가노|가나|가려면|가려고|가는|가고 싶|가야|가자|갈래|갈까|가는 길|어떻게 가|"
                       r"까지|행\b|방면|경로|길 좀|길을|타면|타야|타고|타나|타면 돼|타야 돼|환승|몇 번 버스|무슨 버스|몇 호선|"
                       r"데려다|안내|찾아|어디서 타|어디로 가|도착|출발)")

_SHORT_WORDS = 4  # 이 단어 수 이하일 때만 긍정/부정/취소/다시 로 본다 ("응 그래서 선릉역 가려면" 은 길찾기)


def _has(text: str, words) -> bool:
    """한 글자 표현(응, 어, 네, 예)은 단어 단위로만, 그 외는 공백 제거 후 부분 일치로 찾는다 ("어때"의 "어" 오인 방지)"""
    t = text.replace(" ", "")
    tokens = set(re.sub(r"[^\w가-힣\s]", "", text).split())
    for w in words:
        if len(w) == 1:
            if w in tokens:
                return True
        elif w.replace(" ", "") in t:
            return True
    return False


def classify(text: str, has_place: bool = False) -> str:
    """NAVIGATE / AFFIRM / DENY / CANCEL / REPEAT / UNKNOWN"""
    t = normalize_for_training(text)
    if not t:
        return "UNKNOWN"
    n_words = len(t.split())
    if _NAVIGATE.search(t) or has_place:
        # "아니 선릉역 말고 삼성역" 처럼 장소가 있으면 길찾기(목적지 변경)로 본다
        if n_words <= _SHORT_WORDS and not has_place:
            if _has(t, _CANCEL):
                return "CANCEL"
            if _has(t, _REPEAT):
                return "REPEAT"
        return "NAVIGATE"
    if n_words <= _SHORT_WORDS:
        if _has(t, _CANCEL):
            return "CANCEL"
        if _has(t, _REPEAT):
            return "REPEAT"
        if _has(t, _DENY):
            return "DENY"
        if _has(t, _AFFIRM):
            return "AFFIRM"
    else:
        if _has(t, _REPEAT):
            return "REPEAT"
        if _has(t, _CANCEL):
            return "CANCEL"
    return "UNKNOWN"


def _josa_ro(word: str) -> str:
    """'(으)로' 선택: 받침 없음 또는 ㄹ 받침 → 로, 그 외 받침 → 으로"""
    last = word.strip()[-1] if word.strip() else ""
    if not ("가" <= last <= "힣"):
        return "로"
    code = ord(last) - 0xAC00
    jong = code % 28
    return "로" if jong in (0, 8) else "으로"


def confirm_text(display_name: str) -> str:
    return f"{display_name}{_josa_ro(display_name)} 가시는 게 맞으세요?"


if __name__ == "__main__":
    for s in ["응", "네 맞아요", "아니요", "아니 그거 말고", "그만", "뭐라고요?", "다시 말해 줘",
              "선릉역 가려면 어떻게 가?", "이거 청량리 가요?", "응 선릉역", "경동시장", "오늘 날씨 어때"]:
        print(f"{s!r:22s} -> {classify(s, has_place=s in ('경동시장', '응 선릉역'))}")
    print(confirm_text("선릉역"), "|", confirm_text("경동시장앞 정류장"), "|", confirm_text("서울대학교병원"))
