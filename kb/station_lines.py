"""지하철역마다 "어느 노선의 역이고 앞·다음 역이 어디인가"를 만든다. 키오스크 첫 화면의 역명판 띠(위치 응답의 place.lines)에 쓴다.

입력은 공공 자료 「서울시 역사마스터 정보」(역사_ID, 역사명, 호선, 위도, 경도. 저장소의 server/data 에 있다)다.
이 자료의 '호선'은 운행 노선이 아니라 선로 이름이라, 1호선이 '1호선·경부선·경인선·경원선·장항선'으로 나뉘어 있고
역 순서도 적혀 있지 않다. 그래서 아래 순서로 이어 붙인다.

  1) 선로 이름을 운행 노선으로 묶는다 (LINES). 다른 노선 열차가 함께 서는 역은 그 노선에도 넣는다 (ALSO, ONLY).
  2) 역 번호가 선로 순서대로 붙은 구간(서울교통공사 등)은 번호가 이어지는 역끼리 잇는다.
  3) 나머지(코레일 구간, 갈라지는 곳, 구간과 구간 사이)는 가까운 역끼리 잇되, 이미 이어진 역들은 다시 잇지 않는다.
  4) 나중에 생겨 번호가 순서와 다른 역은 실제로 놓인 두 역 사이로 옮긴다 (동묘앞, 남위례 등).
  5) 가까운 역이 실제 이웃이 아닌 곳은 손으로 바로잡는다 (FORCE, FORBID, CHAINS). 순환선은 양 끝을 잇는다 (LOOPS).
  6) 앞·다음: 노선의 한쪽 끝에서 세어 가까운 쪽이 앞이다. 갈림길에서는 더 긴 쪽을 쓴다. 이웃이 없으면 None (종점).

확인한 범위: 서울 안 역의 종점·갈림길 목록(--report)과 주요 환승역의 앞·다음 역. 서울 밖 구간은 자료가 주는 대로이고 따로 확인하지 않았다.

usage:  python kb/station_lines.py --master "server/data/서울시 역사마스터 정보.csv" --out ~/data/kb_seoul [--report]
출력: <out>/station_lines.json
      { "종로3가": [{"lineId": "seoul-1", "label": "1", "prev": "종각", "next": "종로5가", "lat": 37.57, "lon": 126.99}, ...], ... }
      키는 station_key() 로 만든 이름 (괄호와 끝의 '역'을 뗀 것). 이름이 같은 다른 역(2호선 신촌과 경의중앙선 신촌)도 한 키에 들어 있으므로
      쓰는 쪽은 좌표로 가까운 것만 고른다 (lines_at).
"""
import argparse
import collections
import csv
import json
import math
import os
import re

# 선로 이름('호선' 열) → (lineId, 화면 표지, 역 번호가 선로 순서인가)
LINES = {
    "1호선": ("seoul-1", "1", True), "경부선": ("seoul-1", "1", False), "경인선": ("seoul-1", "1", False),
    "경원선": ("seoul-1", "1", False), "장항선": ("seoul-1", "1", False),
    "2호선": ("seoul-2", "2", True),
    "3호선": ("seoul-3", "3", True), "일산선": ("seoul-3", "3", False),
    "4호선": ("seoul-4", "4", True), "진접선": ("seoul-4", "4", True), "과천선": ("seoul-4", "4", False), "안산선": ("seoul-4", "4", False),
    "5호선": ("seoul-5", "5", True),
    "6호선": ("seoul-6", "6", True),
    "7호선": ("seoul-7", "7", True), "7호선(인천)": ("seoul-7", "7", True),
    "8호선": ("seoul-8", "8", True), "별내선": ("seoul-8", "8", True),
    "9호선": ("seoul-9", "9", True), "9호선(연장)": ("seoul-9", "9", True),
    "경의중앙선": ("gyeongui-jungang", "경의중앙", False), "중앙선": ("gyeongui-jungang", "경의중앙", False),
    "경춘선": ("gyeongchun", "경춘", False),
    "분당선": ("suin-bundang", "수인분당", False), "수인선": ("suin-bundang", "수인분당", False),
    "공항철도1호선": ("arex", "공항철도", True),
    "신분당선": ("sinbundang", "신분당", True), "신분당선(연장)": ("sinbundang", "신분당", True), "신분당선(연장2)": ("sinbundang", "신분당", True),
    "우이신설선": ("ui-sinseol", "우이신설", True), "신림선": ("sillim", "신림", True), "김포골드라인": ("gimpo-gold", "김포골드", True),
    "서해선": ("seohae", "서해", False), "경강선": ("gyeonggang", "경강", False),
    "수도권 광역급행철도": ("gtx-a", "GTX-A", False),
    "의정부선": ("uijeongbu", "의정부", True), "에버라인선": ("everline", "에버라인", True),
    "인천1호선": ("incheon-1", "인천1", True), "인천2호선": ("incheon-2", "인천2", True),
}

# 선로는 다른 이름인데 이 노선 열차가 서는 역: (선로 이름, 역 키) → 넣을 노선들. ONLY 는 원래 노선(LINES) 대신, ALSO 는 원래 노선에 더해서
ONLY = {("경원선", n): ["gyeongui-jungang"] for n in ("이촌", "서빙고", "한남", "옥수", "응봉")}
ONLY[("경원선", "왕십리")] = ["gyeongui-jungang", "suin-bundang"]
ONLY[("경원선", "청량리")] = ["gyeongui-jungang", "suin-bundang", "gyeongchun"]
ALSO = {
    ("경부선", "용산"): ["gyeongui-jungang"],
    ("중앙선", "회기"): ["seoul-1", "gyeongchun"],
    ("중앙선", "중랑"): ["gyeongchun"], ("중앙선", "상봉"): ["gyeongchun"], ("중앙선", "망우"): ["gyeongchun"],
    ("5호선", "까치산"): ["seoul-2"],
}
ALSO.update({("경의중앙선", n): ["seohae"] for n in ("대곡", "능곡", "곡산", "백마", "풍산", "일산")})
ALSO.update({("안산선", n): ["suin-bundang"] for n in ("오이도", "정왕", "신길온천", "안산", "초지", "고잔", "중앙", "한대앞")})

# 가까워도 이웃이 아닌 역 쌍과, 멀어도 이웃인 역 쌍 (노선별, 역 키 기준)
FORBID = {
    "gyeongui-jungang": [("신촌", "서강대"), ("서울", "효창공원앞"), ("서울", "공덕"), ("서울", "용산"), ("신촌", "홍대입구"), ("신촌", "공덕")],
    "seoul-1": [("서울", "용산"), ("구일", "가산디지털단지"), ("관악", "광명"), ("석수", "광명")],
    "seoul-2": [("한양대", "용답"), ("뚝섬", "용답")],
    "seoul-6": [("구산", "새절")],
}
FORCE = {
    "gyeongui-jungang": [("서울", "신촌"), ("신촌", "가좌")],
    "seoul-1": [("구로", "가산디지털단지"), ("금천구청", "광명")],
    "seoul-2": [("성수", "용답")],
    "seoul-6": [("구산", "응암"), ("응암", "새절")],
}
LOOPS = {"seoul-2": ("시청", "충정로")}       # 순환선: 번호가 처음인 역과 끝인 역이 이웃이다
# 개통한 구간만 손으로 적는 노선 (역 사이가 멀고 중간이 끊겨 있어 가까운 역 잇기를 쓰지 않는다). 여기 없는 역은 뺀다
CHAINS = {"gtx-a": [["운정", "운정중앙", "킨텍스", "대곡", "연신내", "서울"], ["수서", "성남", "구성", "동탄"]]}

SEQ_MAX_M = 3500      # 번호가 이어지는 두 역이 이보다 멀면 구간이 끊긴 것으로 본다 (지선의 시작 등)
JOIN_MAX_M = 12000    # 가까운 역끼리 이을 때의 한계. 이보다 멀면 잇지 않는다
SAME_STATION_M = 600  # 이름이 같은 역이 이보다 멀리 있으면 다른 역이다 (서울역의 승강장들은 510 m 안, 2호선 신촌과 경의중앙선 신촌은 715 m)


def station_key(name: str) -> str:
    """역 이름을 맞춰 보기 위한 키: 괄호 부기와 끝의 '역'을 뗀다. '종로3가(탑골공원)' → '종로3가', '서울역' → '서울'"""
    key = re.sub(r"\s*\(.*?\)", "", str(name)).replace(" ", "").strip()
    return key[:-1] if key.endswith("역") and len(key) > 2 else key


def shown_name(name: str) -> str:
    """화면에 적을 이름: 괄호 부기만 뗀다. '광화문(세종문화회관)' → '광화문'. 자료에 '서울'로만 적힌 서울역은 '서울역'으로 맞춘다"""
    shown = re.sub(r"\s*\(.*?\)", "", str(name)).strip()
    return "서울역" if shown == "서울" else shown


def meters(a, b) -> float:
    """두 지점 (위도, 경도) 사이의 거리"""
    rad = math.pi / 180
    dlat, dlon = (b[0] - a[0]) * rad, (b[1] - a[1]) * rad
    h = math.sin(dlat / 2) ** 2 + math.cos(a[0] * rad) * math.cos(b[0] * rad) * math.sin(dlon / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def read_master(path: str) -> list[dict]:
    """역사마스터 CSV → [{id, name, track, lat, lon}] (cp949 또는 utf-8)"""
    rows = []
    for enc in ("cp949", "utf-8-sig"):
        try:
            with open(path, encoding=enc, newline="") as f:
                rows = list(csv.DictReader(f))
            break
        except UnicodeDecodeError:
            continue
    out = []
    for r in rows:
        try:
            out.append({"id": r["역사_ID"].strip(), "name": r["역사명"].strip(), "track": r["호선"].strip(),
                        "lat": float(r["위도"]), "lon": float(r["경도"])})
        except (KeyError, ValueError):
            continue
    return out


def group_by_line(rows: list[dict]) -> dict[str, dict[str, dict]]:
    """운행 노선별로 역을 모은다 → {lineId: {역 키: {name, pos, num, seq, track}}}. 같은 역이 여러 선로에 있으면 번호가 선로 순서인 쪽을 쓴다."""
    lines: dict[str, dict[str, dict]] = collections.defaultdict(dict)
    for r in rows:
        if r["track"] not in LINES:
            continue
        line_id, _, seq = LINES[r["track"]]
        key = station_key(r["name"])
        targets = ONLY.get((r["track"], key)) or [line_id] + ALSO.get((r["track"], key), [])
        digits = re.sub(r"\D", "", r["id"])
        for t in targets:
            own = t == line_id
            node = {"name": shown_name(r["name"]), "pos": (r["lat"], r["lon"]), "num": int(digits) if digits else 0,
                    "seq": seq and own, "track": r["track"] if own else ""}
            old = lines[t].get(key)
            if old is None or (node["seq"] and not old["seq"]):
                lines[t][key] = node
    for line_id, chains in CHAINS.items():
        listed = {k for chain in chains for k in chain}
        lines[line_id] = {k: n for k, n in lines.get(line_id, {}).items() if k in listed}
    return lines


def connect(line_id: str, nodes: dict[str, dict]) -> dict[str, set]:
    """한 노선의 역들을 이웃끼리 잇는다 → {역 키: 이웃 역 키들}"""
    near: dict[str, set] = {k: set() for k in nodes}
    parent = {k: k for k in nodes}

    def find(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k

    def link(a, b):
        near[a].add(b)
        near[b].add(a)
        parent[find(a)] = find(b)

    def dist(a, b):
        return meters(nodes[a]["pos"], nodes[b]["pos"])

    if line_id in CHAINS:                      # 손으로 적은 순서만 쓴다
        for chain in CHAINS[line_id]:
            keys = [k for k in chain if k in nodes]
            for a, b in zip(keys, keys[1:]):
                link(a, b)
        return near

    banned = {frozenset(p) for p in FORBID.get(line_id, [])}
    fixed = set()                               # 손으로 정한 이웃을 가진 역 (4단계에서 옮기지 않는다)
    # 2) 번호가 선로 순서인 구간: 같은 선로 이름 안에서 번호가 이어지는 역끼리
    by_track = collections.defaultdict(list)
    for k, n in nodes.items():
        if n["seq"]:
            by_track[n["track"]].append(k)
    for keys in by_track.values():
        keys.sort(key=lambda k: nodes[k]["num"])
        for a, b in zip(keys, keys[1:]):
            if nodes[b]["num"] - nodes[a]["num"] == 1 and dist(a, b) <= SEQ_MAX_M and frozenset((a, b)) not in banned:
                link(a, b)
    # 5) 손으로 바로잡는 이웃과 순환선
    for a, b in list(FORCE.get(line_id, [])) + ([LOOPS[line_id]] if line_id in LOOPS else []):
        if a in nodes and b in nodes:
            link(a, b)
            fixed.update((a, b))
    # 3) 나머지는 가까운 역끼리. 이미 이어진 무리 안에서는 잇지 않는다
    keys = sorted(nodes)
    pairs = sorted((dist(a, b), a, b) for i, a in enumerate(keys) for b in keys[i + 1:])
    for d, a, b in pairs:
        if d > JOIN_MAX_M:
            break
        if find(a) != find(b) and frozenset((a, b)) not in banned:
            link(a, b)
    # 4) 끝에 매달린 역이 실제로는 다른 두 역 사이에 놓여 있으면 그 사이로 옮긴다 (나중에 생겨 번호가 순서와 다른 역)
    for x in sorted(nodes):
        if len(near[x]) != 1 or x in fixed:
            continue
        best = None
        for p in nodes:
            for q in near[p]:
                if p < q and x not in (p, q) and frozenset((x, p)) not in banned and frozenset((x, q)) not in banned:
                    detour = dist(p, x) + dist(x, q) - dist(p, q)
                    if detour <= max(250.0, 0.3 * dist(p, q)) and (best is None or detour < best[0]):
                        best = (detour, p, q)
        if best:
            _, p, q = best
            (old,) = near[x]
            near[x].discard(old)
            near[old].discard(x)
            near[p].discard(q)
            near[q].discard(p)
            for n in (p, q):
                near[x].add(n)
                near[n].add(x)
    return near


def reach(start: str, blocked: str, near: dict[str, set]) -> int:
    """start 에서 blocked 를 지나지 않고 갈 수 있는 역 수 (갈림길에서 긴 쪽을 고르는 데 쓴다)"""
    seen, stack = {start, blocked}, [start]
    while stack:
        for n in near[stack.pop()]:
            if n not in seen:
                seen.add(n)
                stack.append(n)
    return len(seen) - 1


def depths(nodes: dict[str, dict], near: dict[str, set]) -> dict[str, int]:
    """노선의 한쪽 끝에서 센 거리(역 수). 번호가 순서인 구간이 있으면 그 번호가 커지는 방향과 맞춘다.
    이어지지 않은 무리가 있으면 무리마다 따로 센다."""
    depth: dict[str, int] = {}

    def spread(root, into):
        into[root] = 0
        queue = collections.deque([root])
        while queue:
            k = queue.popleft()
            for n in sorted(near[k]):
                if n not in into:
                    into[n] = into[k] + 1
                    queue.append(n)
        return into

    for start in sorted(nodes):
        if start in depth:
            continue
        group = spread(start, {})
        ends = [k for k in group if len(near[k]) <= 1] or [start]
        seq = sorted((k for k in group if nodes[k]["seq"]), key=lambda k: nodes[k]["num"])
        root = min(ends, key=lambda k: nodes[k]["num"])
        if seq:
            # 번호가 가장 작은 역의 바깥쪽(번호가 커지는 방향의 반대쪽)에 있는 끝 가운데 가장 먼 곳에서 센다.
            # 그래야 끝에서 센 거리가 번호와 같은 방향으로 커지고, 짧은 지선의 끝이 시작점이 되지 않는다
            first = seq[0]
            inner = next((n for n in near[first] if nodes[n]["seq"] and nodes[n]["num"] > nodes[first]["num"]), None)
            outside = spread(first, {inner: -1} if inner else {})
            outer_ends = [k for k in ends if k in outside and k != inner]
            if outer_ends:
                root = max(outer_ends, key=lambda k: (outside[k], -nodes[k]["num"]))
        depth.update(spread(root, {}))
    return depth


def prev_next(key: str, line_id: str, nodes: dict[str, dict], near: dict[str, set], depth: dict[str, int]):
    """한 역의 (앞 역 키, 다음 역 키). 없으면 None"""
    loop = LOOPS.get(line_id)
    if loop and key in loop and loop[0] in near[loop[1]]:      # 순환선의 처음·끝 역
        other = loop[1] if key == loop[0] else loop[0]
        rest = sorted((n for n in near[key] if n != other), key=lambda n: -reach(n, key, near))
        rest = rest[0] if rest else None
        return (other, rest) if key == loop[0] else (rest, other)
    order = (lambda n: nodes[n]["num"]) if loop else (lambda n: depth[n])      # 순환선은 번호로, 나머지는 끝에서 센 거리로
    # 갈림길(이웃 셋 이상)에서는 뒤로 이어진 역이 많은 두 쪽만 쓴다. 짧은 지선 쪽은 앞·다음에 나오지 않는다
    main = sorted(near[key], key=lambda n: (-reach(n, key, near), nodes[n]["num"]))[:2]
    main.sort(key=lambda n: (order(n), nodes[n]["num"]))
    if len(main) == 2:
        return main[0], main[1]
    if len(main) == 1:
        return (main[0], None) if order(main[0]) < order(key) else (None, main[0])
    return None, None


def build(rows: list[dict]) -> dict[str, list[dict]]:
    """역사마스터 행 → {역 키: [{lineId, label, prev, next, lat, lon}]}"""
    labels = {line_id: label for line_id, label, _ in LINES.values()}
    out: dict[str, list[dict]] = collections.defaultdict(list)
    for line_id, nodes in sorted(group_by_line(rows).items()):
        near = connect(line_id, nodes)
        depth = depths(nodes, near)
        for key in sorted(nodes):
            prev, nxt = prev_next(key, line_id, nodes, near, depth)
            out[key].append({"lineId": line_id, "label": labels[line_id],
                             "prev": nodes[prev]["name"] if prev else None, "next": nodes[nxt]["name"] if nxt else None,
                             "lat": round(nodes[key]["pos"][0], 6), "lon": round(nodes[key]["pos"][1], 6)})
    return dict(out)


def lines_at(table: dict, name: str, lat: float, lon: float, within_m: float = SAME_STATION_M) -> list[dict]:
    """역 이름과 좌표로 그 역의 노선 목록을 찾는다 → [{lineId, label, prev, next}] (번호 노선 먼저, 그다음 이름 순).
    이름이 같아도 멀리 있는 역(다른 역)의 노선은 뺀다."""
    found = [e for e in table.get(station_key(name), []) if meters((lat, lon), (e["lat"], e["lon"])) <= within_m]
    found.sort(key=lambda e: (not e["label"].isdigit(), int(e["label"]) if e["label"].isdigit() else 0, e["label"]))
    return [{"lineId": e["lineId"], "label": e["label"], "prev": e["prev"], "next": e["next"]} for e in found]


def report(rows: list[dict]) -> None:
    """눈으로 확인할 것: 노선별 종점(이웃 1개)과 갈림길(이웃 3개 이상)"""
    for line_id, nodes in sorted(group_by_line(rows).items()):
        near = connect(line_id, nodes)
        ends = sorted(nodes[k]["name"] for k in nodes if len(near[k]) == 1)
        forks = sorted(f"{nodes[k]['name']}({','.join(sorted(nodes[n]['name'] for n in near[k]))})" for k in nodes if len(near[k]) >= 3)
        alone = sorted(nodes[k]["name"] for k in nodes if not near[k])
        print(f"{line_id:18s} {len(nodes):3d}역 | 종점 {ends} | 갈림길 {forks}" + (f" | 이웃 없음 {alone}" if alone else ""))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--master", required=True, help="서울시 역사마스터 정보 CSV")
    ap.add_argument("--out", default="~/data/kb_seoul", help="station_lines.json 을 둘 지식베이스 폴더")
    ap.add_argument("--report", action="store_true", help="노선별 종점과 갈림길을 출력한다")
    args = ap.parse_args()
    rows = read_master(os.path.expanduser(args.master))
    if args.report:
        report(rows)
    data = build(rows)
    path = os.path.join(os.path.expanduser(args.out), "station_lines.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=0)
    print(f"wrote {path}: {len(data)} stations, {sum(len(v) for v in data.values())} line entries")


if __name__ == "__main__":
    main()
