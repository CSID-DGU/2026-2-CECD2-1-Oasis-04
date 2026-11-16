"""목적지 해석 보조 (/resolve 전용). 문장 안에서 지식베이스 표기·별칭과 '정확히' 같은 말을 먼저 찾는다.

음성 보정(rag_correct)은 일반 단어를 역 이름으로 바꾸지 않도록 보수적으로 동작해서, '시청', '용산', '신촌'처럼
흔한 말이기도 한 이름이나 '고터', '서울시청', '신천역(옛 이름)' 같은 통칭을 놓친다. 키오스크의 "어디로 가시나요?"
화면에서는 말한 내용이 목적지일 가능성이 높으므로, 여기서는 표기가 정확히 일치하는 경우에 한해 목적지로 본다.
통칭·옛 이름은 kb/data/extra_aliases.csv 에 적으면 지식베이스의 표기로 들어온다.

외부 호출이 없고 TransitKB 만 쓴다 (모델 없이 테스트할 수 있다).
"""
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "kb"))
from normalize import normalize_name  # noqa: E402

PARTICLES = re.compile(r"(까지|으로|로|에서|에게|한테|이랑|하고|보다|이요|예요|이에요|은|는|이|가|을|를|에|요|도|와|과|랑|행|방면|쪽)$")
# 정류장 이름의 일부로 지식베이스 표기에 들어와 있지만 그것만으로는 목적지가 아닌 말
GENERIC = {
    "병원", "시장", "공원", "대학", "대학교", "학교", "터미널", "공항", "입구", "사거리", "삼거리", "오거리", "종점", "차고지",
    "우체국", "주민센터", "경찰서", "소방서", "파출소", "교회", "성당", "아파트", "은행", "마트", "정문", "후문", "건너편",
    "버스", "지하철", "전철", "정류장", "정류소", "출구", "여기", "거기", "저기", "어디", "이거", "그거", "다시", "처음",
    "취소", "그만", "안내", "방법", "시간", "근처", "가는", "타는", "병원앞", "시장앞", "학교앞", "구청", "동사무소",
    "다리", "다리앞", "고개", "언덕", "골목", "시내", "동네", "우리", "집앞",
}
# 서울 밖 지역 이름으로 시작하는 말은 안내 범위 밖으로 본다 ('세종문화회관', '분당선'처럼 서울에서 쓰는 말과 겹치는 지역은 뺐다)
OUTSIDE_REGIONS = ("부산", "대구", "대전", "광주", "울산", "제주", "인천", "수원", "춘천", "강릉", "전주", "청주", "천안",
                   "포항", "경주", "창원", "여수", "목포", "해운대")


def _forms(chunk: str) -> list[str]:
    """한 구간에서 시도할 표기: 그대로, 조사를 뗀 것, 각각 '역'을 붙이거나 뗀 것"""
    full = normalize_name(chunk)
    out = []
    for f in (full, PARTICLES.sub("", full)):
        for g in (f, f[:-1] if f.endswith("역") and len(f) > 2 else f + "역"):
            if g and g not in out:
                out.append(g)
    return out


def _name_core(name: str) -> str:
    n = normalize_name(re.sub(r"\(.*?\)", "", name or ""))
    return n[:-1] if n.endswith("역") and len(n) > 2 else n


def exact_candidates(text: str, kb, kiosk_xy=None, k: int = 5) -> list[dict]:
    """문장에서 지식베이스 표기·별칭과 정확히 같은 구간을 찾아 그 장소들을 돌려준다 (없으면 빈 목록).

    긴 구간을 먼저 본다. 같은 길이에서 여러 구간이 맞으면 이름 자체가 같은 곳(별칭·이름 일부보다 우선),
    지하철역, 긴 표기 순으로 하나를 고른다. '다리 아파 … 신촌 좀 갑시다' 에서 '다리앞' 정류장이 아니라 신촌역을 고르기 위함이다.
    """
    words = text.split()
    for n in (3, 2, 1):
        hits = []
        for i in range(len(words) - n + 1):
            for form in _forms(" ".join(words[i:i + n])):
                if len(form) < 2 or form in GENERIC or not re.search(r"[가-힣A-Za-z]", form):
                    continue
                if form not in kb.term_to_pois:
                    continue
                # 같은 표기를 가진 정류장이 많은 이름(시청, 서울역 …)에서 역이 잘려 나가지 않게 넉넉히 가져온다
                found = [c for c in kb.search(form, kiosk_xy, k=max(k, 20)) if c.get("jamo_sim", 0) >= 0.999]
                if not found:
                    continue
                target = form[:-1] if form.endswith("역") and len(form) > 2 else form
                same_name = [c for c in found if _name_core(c["name"]) == target]
                chosen = same_name or found       # 이름이 같은 곳이 있으면 이름 일부만 겹치는 정류장은 뺀다
                # 이름이 같은 지하철역과 버스 정류장이 함께 있으면 지하철역을 앞세운다 ('시청' → 시청역, '시청역' 정류장은 그다음).
                # 뒤에서 점수순으로 다시 묶으므로 역의 점수를 가장 높은 후보와 맞춰 둔다
                if any(c["poi_type"] == "SUBWAY_STATION" for c in chosen):
                    top_score = max(c["score"] for c in chosen)
                    chosen = sorted(({**c, "score": top_score} if c["poi_type"] == "SUBWAY_STATION" else c for c in chosen),
                                    key=lambda c: c["poi_type"] != "SUBWAY_STATION")
                rank = (0 if same_name else 1, 0 if any(c["poi_type"] == "SUBWAY_STATION" for c in chosen) else 1, -len(form), i)
                hits.append((rank, [{**c, "matched": form} for c in chosen]))
                break
        if hits:
            return min(hits, key=lambda h: h[0])[1]
    return []


def outside_region(text: str) -> str | None:
    """서울 밖 지역 이름으로 시작하는 단어가 있으면 그 지역 이름 ('대전시청' → '대전')"""
    for w in text.split():
        core = normalize_name(w)
        for r in OUTSIDE_REGIONS:
            if core.startswith(r):
                return r
    return None


# ------------------------------------------------------------------ 되묻기
# 사람이라면 "종로 몇 가요?", "어느 터미널이요?" 하고 되물을 상황. 비슷한 후보를 억지로 하나 고르지 않고 질문과 선택지를 돌려준다.
_FAMILY_RE = re.compile(r"^(.{2,}?)([1-9])가(역)?$")
_KOREAN_DIGIT = {"일": 1, "이": 2, "삼": 3, "사": 4, "오": 5, "육": 6, "칠": 7, "팔": 8, "구": 9}
_NUMBER_ANSWER = re.compile(r"^(일|이|삼|사|오|육|칠|팔|구|[1-9])\s*가")
CATEGORY_WORDS = ("터미널", "공항", "병원", "시장", "공원", "대학교", "백화점", "구청")


def _josa_ro(word: str) -> str:
    ch = word.strip()[-1:] if word.strip() else ""
    if "가" <= ch <= "힣":
        return "로" if (ord(ch) - 0xAC00) % 28 in (0, 8) else "으로"
    return "로"


def _wa(word: str) -> str:
    ch = word.strip()[-1:] if word.strip() else ""
    return "과" if "가" <= ch <= "힣" and (ord(ch) - 0xAC00) % 28 != 0 else "와"


def number_families(kb) -> dict:
    """'종로' → {1: '종로1가', 3: '종로3가', …}. 지식베이스 표기 중 'N가' 로 끝나는 이름을 줄기별로 모은다 (처음 한 번만 만든다)."""
    fam = getattr(kb, "_ga_families", None)
    if fam is None:
        fam = {}
        for term in kb.uniq:
            m = _FAMILY_RE.match(term)
            if m:
                fam.setdefault(m.group(1), {})[int(m.group(2))] = f"{m.group(1)}{m.group(2)}가"
        fam = {k: v for k, v in fam.items() if len(v) >= 2}
        kb._ga_families = fam
    return fam


def _place(kb, term: str, kiosk_xy):
    found = [c for c in kb.search(term, kiosk_xy, k=3) if c.get("jamo_sim", 0) >= 0.999]
    if not found:
        return None
    found.sort(key=lambda c: (c["poi_type"] != "SUBWAY_STATION", c.get("distance_m") or 0))
    return {**found[0], "matched": term}


def number_question(text: str, kb, kiosk_xy=None, limit: int = 3):
    """'종로 가려는데요' 처럼 'N가' 가 여럿인 이름의 줄기만 말했을 때 → 되물을 질문과 선택지. 해당 없으면 None.

    → {"ask": {"type": "NUMBER", "stem": "종로", "unit": "가", "numbers": [1, …], "text": "종로 몇 가로 가세요?"}, "candidates": [...]}
    선택지는 지하철역을 먼저, 그다음 가까운 순으로 limit 개.
    """
    fam = number_families(kb)
    for w in text.split():
        full = normalize_name(w)
        for stem in (full, PARTICLES.sub("", full)):
            named = stem in kb.term_to_pois and any(
                _name_core(c["name"]) == stem for c in kb.search(stem, kiosk_xy, k=5) if c.get("jamo_sim", 0) >= 0.999)
            if stem in fam and not named:     # '충무로'처럼 그 이름의 역이 따로 있으면 묻지 않는다
                numbers = sorted(fam[stem])
                places = [p for p in (_place(kb, fam[stem][n], kiosk_xy) for n in numbers) if p]
                places.sort(key=lambda c: (c["poi_type"] != "SUBWAY_STATION", c.get("distance_m") or 0))
                if len(places) < 2:
                    continue
                span = f"{numbers[0]}가부터 {numbers[-1]}가까지 있어요." if len(numbers) > 2 else ""
                return {"ask": {"type": "NUMBER", "stem": stem, "unit": "가", "numbers": numbers,
                                "text": f"{stem} 몇 가로 가세요? {span}".strip()},
                        "candidates": places[:limit]}
    return None


def apply_context(text: str, context) -> str:
    """앞의 되묻기에 대한 짧은 답('삼가요', '5가')을 그 질문의 줄기와 합친다 → '종로3가'. 해당 없으면 text 그대로."""
    if not isinstance(context, dict) or context.get("type") != "NUMBER" or not context.get("stem"):
        return text
    m = _NUMBER_ANSWER.match(text.strip())
    if not m:
        return text
    digit = _KOREAN_DIGIT.get(m.group(1)) or int(m.group(1))
    return f"{context['stem']}{digit}가"


def category_question(text: str, kb, kiosk_xy=None, limit: int = 3):
    """'터미널 가려는데요' 처럼 종류만 말했을 때 → "어느 터미널로 가세요?" 와 가까운 선택지. 해당 없으면 None."""
    for w in text.split():
        full = normalize_name(w)
        for word in (full, PARTICLES.sub("", full)):
            if word not in CATEGORY_WORDS:
                continue
            with kb._lock:
                rows = [dict(r) for r in kb.con.execute("SELECT * FROM transit_poi WHERE name LIKE ?", (f"%{word}%",))]
            stations = [r for r in rows if r["poi_type"] == "SUBWAY_STATION"]
            rows = stations if len(stations) >= 2 else rows       # 역 이름에 들어 있으면 역만 보여 준다 (터미널, 공항)
            if kiosk_xy:
                from search import haversine_m
                for r in rows:
                    r["distance_m"] = int(haversine_m(kiosk_xy[0], kiosk_xy[1], r["x"], r["y"]))
                rows.sort(key=lambda r: r["distance_m"])
            seen, places = set(), []
            for r in rows:
                key = _name_core(r["name"])
                if key in seen:
                    continue
                seen.add(key)
                places.append({**r, "score": 0.5, "jamo_sim": 0.0, "matched": word})
                if len(places) >= limit:
                    break
            if len(places) >= 2:
                return {"ask": {"type": "CATEGORY", "word": word, "text": f"어느 {word}{_josa_ro(word)} 가세요?"}, "candidates": places}
    return None


def choice_text(names: list[str]) -> str:
    """후보가 여럿일 때의 질문: '시청역과 서울시청 정류장 중 어디로 가세요?'"""
    if len(names) == 2:
        return f"{names[0]}{_wa(names[0])} {names[1]} 중 어디로 가세요?"
    return "다음 중 어디로 가세요? " + ", ".join(names)
