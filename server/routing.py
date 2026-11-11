"""경로 후처리 (명세 3.4절). 지도 API 가 준 경로를 어르신 맞춤 점수로 다시 줄 세우고 쉬운 문장으로 바꾼다.

제공자(카카오 등)에 상관없이 아래 '공통 경로' 모양을 입력으로 받는다. 외부 호출이 없는 순수 함수라 단위 테스트가 쉽다.
  route = {"type": "BUS" | "SUBWAY" | "MIXED", "total_sec": int, "total_m": int | None, "transfers": int,
           "fare": int | None, "fare_max": int | None,
           "steps": [{"mode": "WALK" | "BUS" | "SUBWAY", "sec": int, "m": int,
                      "stops": ["정류장 이름", ...], "vehicles": [{"name": "273", "type": "간선"}, ...],
                      "from_xy": [x, y] | None, "to_xy": [x, y] | None,    # 그 단계의 첫·끝 좌표 (경도, 위도)
                      "exit": "1" | None}]}                                # 도보 단계의 지하철 출구 번호

카카오는 출발지→첫 정류장, 마지막 정류장→목적지 도보를 단계로 주지 않고 합계(total_m, total_sec)에만 넣는다.
그래서 합계에서 단계 합을 뺀 나머지를 앞뒤 도보로 보고, 좌표가 있으면 직선거리 비율로 나눠 걷는 단계를 만들어 넣는다.
요청에 시각을 줄 수 없어서 낮에도 심야버스가 섞여 온다. now 를 주면 지금 다니지 않는 차량과 그 차량뿐인 경로를 뺀다.

어르신 맞춤 점수 (낮을수록 좋음):  elder_score = 소요시간(분) + A × 환승 횟수 + B × (도보 m ÷ 100)
"""
import math
import re

ELDER_A = 10.0   # 환승 1회의 부담 (분으로 환산)
ELDER_B = 2.0    # 도보 100m 의 부담 (분으로 환산)
MAX_ROUTES = 3
FIRST_WALK_MIN_M = 50   # 타는 곳이 이보다 가까우면 '걸어가세요' 단계를 넣지 않는다 (키오스크가 정류장에 있는 경우)
LAST_WALK_MIN_M = 30    # 내린 곳에서 목적지가 이보다 가까우면 넣지 않는다

# 서울 시내버스 색. 어르신께는 번호보다 색이 먼저 보인다
BUS_COLOR = {"간선": "파란", "지선": "초록", "광역": "빨간", "직행": "빨간", "순환": "노란"}
PAREN_RE = re.compile(r"\([^)]*\)")
MARK_RE = re.compile(r"^(.*?)\(([^)]*)\)$")


class RouteError(Exception):
    """경로를 돌려줄 수 없는 경우. code 는 API 명세 2.5절의 에러 코드."""

    def __init__(self, code: str, message: str, easy: str | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.easy = easy


# ------------------------------------------------------------------ 한국어 도우미
def _jong(word: str):
    """마지막 글자의 받침 번호 (없으면 0, ㄹ 은 8). 숫자는 읽는 소리 기준. 판단할 수 없으면 None"""
    w = word.strip()
    if not w:
        return None
    ch = w[-1]
    if "가" <= ch <= "힣":
        return (ord(ch) - 0xAC00) % 28
    if ch.isdigit():   # 0 영, 1 일, 2 이, 3 삼, 4 사, 5 오, 6 육, 7 칠, 8 팔, 9 구
        return {"0": 21, "1": 8, "3": 16, "6": 1, "7": 8, "8": 8}.get(ch, 0)
    return None


def has_final(word: str) -> bool:
    """마지막 글자에 받침이 있는지. 숫자로 끝나면 읽는 소리 기준(0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔 은 받침 있음)."""
    return bool(_jong(word))


def eul(word: str) -> str:
    return f"{word}{'을' if has_final(word) else '를'}"


def ro(word: str) -> str:
    """'2호선으로', '신림선으로', '9번으로'. 받침이 없거나 ㄹ 받침이면 '로'"""
    return f"{word}{'로' if _jong(word) in (0, 8, None) else '으로'}"


def station(name: str) -> str:
    """'교대(법원.검찰청)' → '교대역'. 역 이름 뒤의 괄호 부기는 읽기 어려워서 뺀다"""
    n = PAREN_RE.sub("", name).strip() or name.strip()
    return n if n.endswith("역") else n + "역"


def bus_stop(name: str) -> str:
    n = name.strip()
    return n if n.endswith(("정류장", "정류소")) else n + " 정류장"


def same_place(a: str, b: str) -> bool:
    """'선릉' 과 '선릉역', '서울아산병원동관' 과 '서울아산병원동관 정류장' 처럼 같은 곳을 가리키는 이름인지"""
    def core(name):
        n = PAREN_RE.sub("", name).replace(" ", "")
        for suffix in ("정류장", "정류소", "역"):
            if n.endswith(suffix) and len(n) > len(suffix):
                n = n[: -len(suffix)]
        return n
    return bool(a.strip()) and core(a) == core(b)


def split_mark(name: str) -> tuple[str, str]:
    """'8641(평일)' → ('8641', '평일'), 'N15(심야)' → ('N15', '심야'), '472' → ('472', '')"""
    n = name.strip()
    m = MARK_RE.match(n)
    return (m.group(1).strip(), m.group(2).strip()) if m else (n, "")


def runs_now(mark: str, now) -> bool:
    """운행 조건이 붙은 차량이 지금 다니는지. now(datetime) 가 None 이면 따지지 않는다"""
    if not mark or now is None:
        return True
    if "심야" in mark:
        return now.hour >= 23 or now.hour < 5
    if "평일" in mark:
        return now.weekday() < 5
    if "주말" in mark or "휴일" in mark:
        return now.weekday() >= 5
    return True


def usable_vehicles(vehicles, now=None) -> list[dict]:
    """이름이 같은 차량은 하나로 합치고 지금 다니지 않는 차량(낮의 심야버스 등)은 뺀다. 조건 없는 차량을 앞에 둔다."""
    seen, plain, marked = set(), [], []
    for v in vehicles or []:
        name, mark = split_mark(str(v.get("name", "")))
        if not name or name in seen or not runs_now(mark, now):
            continue
        seen.add(name)
        (marked if mark else plain).append({"name": name, "type": str(v.get("type", "")).strip(), "mark": mark})
    return plain + marked


def bus_label(vehicle: dict) -> str:
    """'파란 버스 273번', '마을버스 종로09번', '공항버스 6011번', '심야버스 N15번', '1005번 버스'"""
    name, mark = split_mark(str(vehicle.get("name", "")))
    mark = str(vehicle.get("mark") or mark)
    kind = str(vehicle.get("type", "")).strip()
    number = name if name.endswith("번") else name + "번"
    if "심야" in mark:
        return f"심야버스 {number}"
    if kind in BUS_COLOR:
        return f"{BUS_COLOR[kind]} 버스 {number}"
    if kind in ("마을", "공항"):
        return f"{kind}버스 {number}"
    return f"{number} 버스"


def subway_label(vehicle: dict) -> str:
    """'2호선', '수인분당선'. 이름 앞의 '수도권' 은 뺀다"""
    name = str(vehicle.get("name", "")).strip().replace("수도권 ", "").replace("수도권", "")
    return name or "지하철"


def minutes(sec) -> int:
    return max(1, math.ceil((sec or 0) / 60)) if sec else 0


def round10(m) -> int:
    """10미터 단위 반올림 (125 → 130). 파이썬 round 는 12.5 를 12 로 내리므로 쓰지 않는다"""
    return int(math.floor((m or 0) / 10.0 + 0.5) * 10)


def haversine_m(x1, y1, x2, y2) -> float:
    r = 6371000.0
    p1, p2 = math.radians(y1), math.radians(y2)
    dp, dl = math.radians(y2 - y1), math.radians(x2 - x1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# ------------------------------------------------------------------ 변환
def outer_walk(route: dict, origin_xy=None, dest_xy=None):
    """합계에는 있지만 단계에는 없는 앞뒤 도보 → (앞 m, 앞 초, 뒤 m, 뒤 초). 나눌 근거가 없으면 모두 None."""
    none = (None, None, None, None)
    steps = route.get("steps") or []
    if not steps or not route.get("total_m"):
        return none
    rest_m = int(route["total_m"]) - sum(int(s.get("m") or 0) for s in steps)
    if rest_m <= 0:
        return none
    rest_sec = max(0, int(route.get("total_sec") or 0) - sum(int(s.get("sec") or 0) for s in steps))
    first_open, last_open = steps[0]["mode"] != "WALK", steps[-1]["mode"] != "WALK"
    if first_open and last_open:
        a, b = steps[0].get("from_xy"), steps[-1].get("to_xy")
        if not (origin_xy and dest_xy and a and b):
            return none
        d1 = haversine_m(origin_xy[0], origin_xy[1], a[0], a[1])
        d2 = haversine_m(b[0], b[1], dest_xy[0], dest_xy[1])
        share = d1 / (d1 + d2) if d1 + d2 > 0 else 0.5
    elif first_open:
        share = 1.0
    elif last_open:
        share = 0.0
    else:
        return none
    first_m = rest_m * share
    return first_m, rest_sec * share, rest_m - first_m, rest_sec * (1 - share)


def walk_text(prev, nxt, nxt_vehicles, dist: int, exit_no, dest_name: str) -> str:
    """걷는 단계의 문장. prev·nxt 는 앞뒤의 탑승 단계(없으면 None), nxt_vehicles 는 다음에 탈 차량 목록."""
    if nxt is None:
        return f"{dest_name}까지 {dist}미터 걸어가세요."
    board = (nxt.get("stops") or [""])[0]
    if nxt["mode"] == "SUBWAY":
        line = subway_label(nxt_vehicles[0]) if nxt_vehicles else "지하철"
        if not board:
            return f"{line} 타는 곳까지 {dist}미터 걸어가세요."
        if prev is None:
            return f"{station(board)} {line} 타는 곳까지 {dist}미터 걸어가세요."
        if prev["mode"] == "SUBWAY":
            return f"{station(board)}에서 {ro(line)} 갈아타세요. {dist}미터쯤 걸어요."
        gate = f" {exit_no}번 출구" if exit_no else ""
        return f"{station(board)}{gate}까지 {dist}미터 걸어가세요."
    if not board:
        return f"버스 타는 곳까지 {dist}미터 걸어가세요."
    if prev is not None and prev["mode"] == "BUS" and (prev.get("stops") or [""])[-1] == board:
        # 같은 이름의 다른 승강장으로 옮겨 타는 경우
        return f"내린 곳에서 {dist}미터 걸어가서 갈아타세요. 타는 곳 이름도 {board}{'이에요' if has_final(board) else '예요'}."
    if exit_no and prev is not None and prev["mode"] == "SUBWAY":
        return f"{exit_no}번 출구로 나와서 {bus_stop(board)}까지 {dist}미터 걸어가세요."
    return f"{bus_stop(board)}까지 {dist}미터 걸어가세요."


def build_steps(route: dict, dest_name: str, origin_xy=None, dest_xy=None, now=None) -> list[dict]:
    """경로 하나의 단계 목록. 지금 다니는 차가 없는 구간이 있으면 빈 목록(그 경로는 쓰지 않는다)."""
    raw = [s for s in route.get("steps", []) if not (s["mode"] == "WALK" and round10(s.get("m")) == 0)]
    rides = {}
    for i, s in enumerate(raw):
        if s["mode"] != "WALK":
            given = s.get("vehicles") or []
            usable = usable_vehicles(given, now)
            if given and not usable:
                return []
            rides[i] = usable or [{"name": "", "type": "", "mark": ""}]
    first_m, first_sec, last_m, last_sec = outer_walk(route, origin_xy, dest_xy)

    out = []

    def add(step):
        step["order"] = len(out) + 1
        out.append(step)

    if raw and raw[0]["mode"] != "WALK" and first_m is not None and round10(first_m) >= FIRST_WALK_MIN_M:
        dist = round10(first_m)
        add({"mode": "WALK", "minutes": minutes(first_sec), "distance_m": dist,
             "easy_text": walk_text(None, raw[0], rides[0], dist, None, dest_name)})

    for i, s in enumerate(raw):
        if s["mode"] == "WALK":
            dist = round10(s.get("m"))
            prev = raw[i - 1] if i > 0 and raw[i - 1]["mode"] != "WALK" else None
            j = next((k for k in range(i + 1, len(raw)) if raw[k]["mode"] != "WALK"), None)
            add({"mode": "WALK", "minutes": minutes(s.get("sec")), "distance_m": dist,
                 "easy_text": walk_text(prev, raw[j] if j is not None else None, rides.get(j), dist, s.get("exit"), dest_name)})
            continue
        stops = [str(x) for x in s.get("stops") or []]
        vehicles = rides[i]
        board, alight = (stops[0], stops[-1]) if stops else ("", "")
        n = max(1, len(stops) - 1) if stops else 0
        step = {"mode": s["mode"], "minutes": minutes(s.get("sec"))}
        if s["mode"] == "SUBWAY":
            label = subway_label(vehicles[0])
            step.update({"line": label, "board": PAREN_RE.sub("", board).strip() or board,
                         "alight": PAREN_RE.sub("", alight).strip() or alight, "stops": n})
            step["easy_text"] = (f"{station(board)}에서 {eul(label)} 타고, {n}정거장 가서 {station(alight)}에서 내리세요."
                                 if stops else f"{eul(label)} 타세요.")
        else:
            label = bus_label(vehicles[0])
            step.update({"line": vehicles[0]["name"], "bus_type": vehicles[0]["type"],
                         "board": board, "alight": alight, "stops": n})
            others = [v["name"] for v in vehicles[1:4] if v["name"]]
            if others:
                step["line_alternatives"] = others
            step["easy_text"] = (f"{bus_stop(board)}에서 {eul(label)} 타고, {n}정거장 가서 {bus_stop(alight)}에서 내리세요."
                                 if stops else f"{eul(label)} 타세요.")
        add(step)

    if raw and raw[-1]["mode"] != "WALK" and last_m is not None and round10(last_m) >= LAST_WALK_MIN_M:
        alight = (raw[-1].get("stops") or [""])[-1]
        # 내린 곳이 곧 목적지면 '○○역까지 걸어가세요' 를 다시 말하지 않는다.
        # 버스는 목적지가 정류장일 때만 그렇게 본다 ('선릉역' 정류장에서 내려 선릉역으로 가는 길은 안내한다)
        at_dest = same_place(alight, dest_name) and (
            raw[-1]["mode"] == "SUBWAY" or dest_name.strip().endswith(("정류장", "정류소")))
        if not at_dest:
            dist = round10(last_m)
            add({"mode": "WALK", "minutes": minutes(last_sec), "distance_m": dist,
                 "easy_text": walk_text(None, None, None, dist, None, dest_name)})
    return out


def merge_same_stops(scored: list[dict]) -> list[dict]:
    """타고 내리는 곳이 모두 같은 경로(버스 번호만 다른 경우)는 하나로 합치고, 나머지 번호는 line_alternatives 에 넣는다.

    합칠 때는 요금이 싼 쪽을 대표로 삼는다 (같은 구간이면 시간·도보가 거의 같고 요금만 다르다).
    """
    groups = {}
    for r in scored:
        sig = tuple((s["mode"], s.get("board"), s.get("alight")) for s in r["steps"] if s["mode"] != "WALK")
        groups.setdefault(sig, []).append(r)
    merged = []
    for members in groups.values():
        best = min(members, key=lambda r: (r["fare"] if r["fare"] is not None else 10 ** 9, r["elder_score"]))
        best_rides = [s for s in best["steps"] if s["mode"] != "WALK"]
        for other in members:
            if other is best:
                continue
            for mine, theirs in zip(best_rides, (s for s in other["steps"] if s["mode"] != "WALK")):
                if mine["mode"] != "BUS":
                    continue
                alts = mine.get("line_alternatives", [])
                for name in [theirs.get("line", "")] + theirs.get("line_alternatives", []):
                    if name and name != mine["line"] and name not in alts and len(alts) < 3:
                        alts.append(name)
                if alts:
                    mine["line_alternatives"] = alts
        merged.append(best)
    return merged


def summarize(steps: list[dict]) -> str:
    """'지하철 2호선 → 버스 273번'. 화면 목록의 한 줄 요약"""
    parts = []
    for s in steps:
        if s["mode"] == "SUBWAY":
            parts.append(f"지하철 {s.get('line', '')}".strip())
        elif s["mode"] == "BUS":
            line = s.get("line", "")
            parts.append(f"버스 {line if line.endswith('번') else line + '번'}".strip())
    return " → ".join(parts) if parts else "걸어서 이동"


def headline(total_min: int, transfers: int, walk_m: int) -> str:
    t = "갈아타지 않아요" if transfers == 0 else f"{transfers}번 갈아타요"
    w = "거의 안 걸어요" if walk_m < 50 else f"{walk_m}미터 걸어요"
    return f"{total_min}분 · {t} · {w}"


def to_response_routes(routes: list[dict], dest_name: str, max_routes: int = MAX_ROUTES,
                       a: float = ELDER_A, b: float = ELDER_B, origin_xy=None, dest_xy=None, now=None) -> list[dict]:
    """공통 경로 목록 → 명세의 routes[] (어르신 맞춤 점수 오름차순, 최대 max_routes 개).

    origin_xy·dest_xy (경도, 위도) 를 주면 앞뒤 도보를 단계로 넣고, now(datetime) 를 주면 지금 다니지 않는 차량을 뺀다.
    """
    scored = []
    for r in routes:
        steps = build_steps(r, dest_name, origin_xy, dest_xy, now)
        if not steps:
            continue
        total_min = minutes(r.get("total_sec"))
        ride_m = sum(int(s.get("m") or 0) for s in r.get("steps", []) if s["mode"] != "WALK")
        listed_walk = sum(int(s.get("m") or 0) for s in r.get("steps", []) if s["mode"] == "WALK")
        # 걷는 거리 = 전체 − 타고 가는 거리. 단계에 없는 앞뒤 도보까지 들어간다
        walk_m = round10(max(listed_walk, int(r.get("total_m") or 0) - ride_m))
        transfers = int(r.get("transfers") or 0)
        scored.append({
            "path_type": r.get("type", "MIXED"),
            "total_min": total_min,
            "transfers": transfers,
            "walk_m": walk_m,
            "fare": r.get("fare"),
            "fare_max": r.get("fare_max"),
            "elder_score": round(total_min + a * transfers + b * (walk_m / 100.0), 1),
            "headline": headline(total_min, transfers, walk_m),
            "summary": summarize(steps),
            "steps": steps,
        })
    scored = merge_same_stops(scored)
    # 같은 점수면 제공자가 준 순서(추천순)를 유지한다
    scored.sort(key=lambda r: r["elder_score"])
    top = scored[: max(1, min(int(max_routes), MAX_ROUTES))]
    for i, r in enumerate(top, 1):
        r["rank"] = i
    return top
