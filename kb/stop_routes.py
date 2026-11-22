"""버스정류장마다 "어떤 버스가 서고 앞·다음 정류장이 어디인가"를 만든다. 키오스크 첫 화면의 역명판 띠(위치 응답의 place)에 쓴다.

입력은 공공 자료 「서울시버스노선별정류소정보」다 (서울 열린데이터광장 '서울시 버스 노선 정보 조회' OA-1095 의 파일. 저장소에는 넣지 않는다).
열은 ROUTE_ID, 노선명, 순번, NODE_ID, ARS_ID, 정류소명, X좌표, Y좌표 이고, 노선마다 기점에서 종점까지 서는 순서대로 한 줄씩 있다.

  1) 노선별로 순번대로 늘어놓는다. 서지 않고 지나가는 지점인 '(가상)' 정류소는 뺀다.
  2) 정류장마다 그곳에 서는 버스 번호를 모으고, 종류(간선·지선 등)는 번호 모양으로 가린다 (bus_kind). 자료에 종류 열이 없다.
  3) 버스 묶음(buses): 종류가 같고 바로 앞에 선 곳·바로 다음에 서는 곳이 같은 버스끼리 한 묶음이다.
     같은 정류장이어도 버스마다 앞·다음 정류장이 다른 곳이 많다 (2026-09-02 판에서 정류장의 37%). 건너뛰는 정류장이 다르거나 길이 갈리기 때문이다.
     예) DMC파인시티자이(12325): 7212 는 다음이 디지털미디어시티역, 7017 은 수색역앞, 7715 는 수색역
     묶음은 종류 순서(KINDS)대로, 같은 종류 안에서는 다음 정류장이 중앙차로 정류장인 묶음을 먼저, 그다음 버스가 많은 묶음부터 적는다.
     여기서 출발하는 버스는 앞이 None, 여기서 끝나는 버스는 다음이 None 이다.
     중앙차로 여부(nextMedian)는 「서울시 버스정류소 위치정보」의 정류소타입 열로 가린다 (--stops. 지식베이스의 서울 정류장을 만드는 그 파일이다).
     그 파일에 없는 정류장(경기 쪽)은 이름이 '(중)' 으로 끝나면 중앙차로로 본다. 파일을 주지 않으면 이름으로만 가린다.
  4) 정류장의 앞·다음(prev·next): 그 정류장에 서는 노선들이 가리키는 곳 가운데 노선 수가 가장 많은 곳 하나씩.
     모든 노선이 여기서 출발하면 앞이 None, 모든 노선이 여기서 끝나면 다음이 None 이다.

확인한 범위: 서울시 파일에 있는 노선(시내·마을·공항·심야 등 718개, 2026-09-02 판)만이다. 서울을 지나는 경기·인천 버스는 이 파일에 없어서 빠진다.

usage:  python kb/stop_routes.py --routes ~/data/public/seoul_bus_routes/seoul_bus_route_stops_20260902.xlsx \
            --stops ~/data/public/seoul_bus_stops_20260902.xlsx --out ~/data/kb_seoul [--report]
출력: <out>/stop_routes.json
      { "100000010": {"ars": "01010", "name": "종로3가.탑골공원", "lat": 37.570, "lon": 126.988, "prev": "종로2가", "next": "종로4가.종묘",
                      "buses": [{"kind": "TRUNK", "numbers": ["101", "260"], "prev": "종로2가", "next": "종로4가.종묘", "nextMedian": true},
                                {"kind": "BRANCH", "numbers": ["7212"], "prev": "낙원상가", "next": "창덕궁", "nextMedian": false}]}, ... }
      키는 NODE_ID 다. 「서울시 버스정류소 위치정보」의 NODE_ID 와 같아서 지식베이스의 poi_id('BUS_<NODE_ID>')로 바로 찾는다.
      다른 자료로 만든 정류장은 정류장 번호(ARS_ID)와 좌표로 찾는다 (stop_at).
"""
import argparse
import collections
import csv
import io
import json
import math
import os
import re

# 화면(프런트 디자인 문서 8-5절)이 아는 종류. 여기에 없는 버스는 OTHER 로 보내고 화면은 "그 밖"으로 보인다
KINDS = ("TRUNK", "BRANCH", "EXPRESS", "CIRCULAR", "VILLAGE", "NIGHT", "AIRPORT", "OTHER")
SAME_STOP_M = 150.0     # 정류장 번호로 찾을 때 이 거리 안이어야 같은 정류장으로 본다 (번호가 같은 다른 지역 정류장을 거른다)
COLUMNS = {"route_id": "ROUTE_ID", "route": "노선명", "seq": "순번", "node": "NODE_ID", "ars": "ARS_ID",
           "name": "정류소명", "x": "X좌표", "y": "Y좌표"}
MEDIAN_TYPE = "중앙차로"  # 「서울시 버스정류소 위치정보」 정류소타입 열의 값 (그 밖: 일반차로, 가로변시간, 가로변전일, 마을버스)
MEDIAN_TAIL = "(중)"      # 그 파일에 없는 정류장은 이름 끝의 이 표시로 가린다 ('종로3가.탑골공원(중)')


def bus_number(route_name: str) -> str:
    """노선명 → 버스에 적힌 번호. 방향·구간을 적은 꼬리를 뗀다.
    '110A고려대' → '110A', '5522B호암' → '5522B', '8442퇴근' → '8442', '서울07출근' → '서울07'. 그 밖은 그대로"""
    name = str(route_name).strip()
    m = re.match(r"^(N?\d+[A-Z]?(?:-\d+)?)[가-힣]+$", name)
    if m:
        return m.group(1)
    return re.sub(r"(출근|퇴근)$", "", name) or name


def bus_kind(number: str) -> str:
    """버스 번호 → 종류. 서울 버스의 번호 규칙을 따른다.

      N…, 심야…           NIGHT    (심야버스. 'N6001' 같은 심야 공항버스도 여기)
      두 자리 (01A, 01B)   CIRCULAR (순환)
      세 자리 (101)        TRUNK    (간선)
      네 자리 9…  (9401)   EXPRESS  (광역)
      네 자리 60…, 6100~6109·6200·6701 처럼 끝 두 자리가 10 미만   AIRPORT (공항버스. 지선 6211·6411·6712 는 끝 두 자리가 11 이상)
      그 밖의 네 자리 (7212, 맞춤버스 8xxx 포함)   BRANCH (지선)
      구 이름 + 숫자 (종로01, 성동03-2)   VILLAGE (마을)
      그 밖 (서울동행버스 '서울07', 자율주행 '청계A01', 한강버스 연계 등)   OTHER
    """
    n = str(number).strip()
    if n.startswith(("N", "심야")):
        return "NIGHT"
    m = re.match(r"\d+", n)
    if m:
        digits = m.group()
        if len(digits) == 2:
            return "CIRCULAR"
        if len(digits) == 3:
            return "TRUNK"
        if len(digits) == 4:
            if digits[0] == "9":
                return "EXPRESS"
            if digits[0] == "6" and (digits[1] == "0" or int(digits[2:]) < 10):
                return "AIRPORT"
            return "BRANCH"
        return "OTHER"
    if re.match(r"서울\d", n):
        return "OTHER"
    if re.match(r"[가-힣]+\d", n):
        return "VILLAGE"
    return "OTHER"


def number_order(number: str):
    """번호를 사람이 읽는 순서로: 숫자 먼저 작은 것부터, 그다음 글자 ('101' < '9401' < '9401-1' < 'N13' < '종로01')"""
    m = re.match(r"\d+", number)
    return (0, int(m.group()), number) if m else (1, 0, number)


def is_virtual(name: str) -> bool:
    """서지 않고 지나가는 지점 ('신공항TG(가상)' 등)"""
    return "(가상)" in str(name)


def meters(lat1, lon1, lat2, lon2) -> float:
    kx = 111320.0 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot((lon1 - lon2) * kx, (lat1 - lat2) * 110540.0)


def read_table(path: str) -> list[list[str]]:
    """XLSX(첫 시트) 또는 CSV → 줄 목록 (첫 줄이 열 이름). 빈 줄은 뺀다"""
    path = os.path.expanduser(path)
    if path.lower().endswith((".xlsx", ".xlsm")):
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        table = [["" if v is None else str(v) for v in r] for r in wb[wb.sheetnames[0]].iter_rows(values_only=True)]
    else:
        raw = open(path, "rb").read()
        for enc in ("utf-8-sig", "cp949"):
            try:
                text = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise ValueError(f"인코딩을 알 수 없음: {path}")
        table = list(csv.reader(io.StringIO(text)))
    return [r for r in table if any(c.strip() for c in r)]


def read_stop_types(path: str) -> dict[str, str]:
    """「서울시 버스정류소 위치정보」(XLSX 또는 CSV) → {NODE_ID: 정류소타입}. 중앙차로 정류장을 가리는 데 쓴다"""
    table = read_table(path)
    header = [h.strip() for h in table[0]]
    missing = [c for c in ("NODE_ID", "정류소타입") if c not in header]
    if missing:
        raise KeyError(f"열을 찾을 수 없음: {missing} / header={header}")
    node, kind = header.index("NODE_ID"), header.index("정류소타입")
    return {r[node].strip(): r[kind].strip() for r in table[1:] if len(r) > max(node, kind) and r[node].strip()}


def is_median(node: str, name: str, types: dict | None) -> bool:
    """중앙차로 정류장인가. 정류소타입 표에 있는 정류장은 그 값으로, 없는 정류장은 이름 끝의 '(중)' 으로 가린다"""
    if types and node in types:
        return types[node] == MEDIAN_TYPE
    return str(name).strip().endswith(MEDIAN_TAIL)


def read_routes(path: str) -> list[dict]:
    """노선별 정류소 파일(XLSX 또는 CSV) → [{route_id, route, seq, node, ars, name, x, y}]. 좌표나 순번이 없는 줄은 버린다"""
    table = read_table(path)
    header = [h.strip() for h in table[0]]
    missing = [c for c in COLUMNS.values() if c not in header]
    if missing:
        raise KeyError(f"열을 찾을 수 없음: {missing} / header={header}")
    at = {key: header.index(col) for key, col in COLUMNS.items()}
    out = []
    for r in table[1:]:
        try:
            ars = r[at["ars"]].strip()
            out.append({
                "route_id": r[at["route_id"]].strip(), "route": r[at["route"]].strip(), "seq": int(float(r[at["seq"]])),
                "node": r[at["node"]].strip(),
                "ars": ars.zfill(5) if ars.isdigit() else ars,      # 엑셀에서 앞의 0 이 빠진 번호 ('7832' → '07832')
                "name": r[at["name"]].strip(), "x": float(r[at["x"]]), "y": float(r[at["y"]]),
            })
        except (ValueError, IndexError):
            continue
    return out


def most_voted(votes: collections.Counter):
    """가장 많은 노선이 가리킨 이름. 수가 같으면 이름 순으로 앞선 것 (실행할 때마다 같은 결과가 나오게)"""
    if not votes:
        return None
    return min(votes.items(), key=lambda kv: (-kv[1], kv[0]))[0]


def build(rows: list[dict], types: dict | None = None) -> dict[str, dict]:
    """노선별 정류소 행 → {NODE_ID: {ars, name, lat, lon, prev, next, buses}}

    buses 는 [{kind, numbers, prev, next, nextMedian}]: 종류와 앞·다음 정류장이 같은 버스끼리 한 묶음.
    nextMedian 은 그 묶음의 버스가 다음에 서는 정류장이 중앙차로 정류장인가 (types 는 read_stop_types 의 표. 없으면 이름의 '(중)' 으로만 가린다).
    이름이 같은 중앙차로·길가 정류장으로 나뉘어 가는 묶음은 절반 이상이 중앙차로로 가면 True.
    순서: 종류 순서 → 중앙차로로 가는 묶음 → 버스가 많은 묶음.
    같은 정류장을 두 번 지나는 버스(돌아 나오는 노선)는 앞·다음이 다르면 두 묶음에 모두 들어간다.
    """
    by_route = collections.defaultdict(list)
    for r in rows:
        if not is_virtual(r["name"]):
            by_route[r["route_id"]].append(r)
    stops: dict[str, dict] = {}
    ways = collections.defaultdict(lambda: collections.defaultdict(set))       # 정류장 → 버스 번호 → {(앞, 다음, 다음이 중앙차로인가)}
    before = collections.defaultdict(collections.Counter)
    after = collections.defaultdict(collections.Counter)
    for route_id in sorted(by_route):
        seq = sorted(by_route[route_id], key=lambda r: r["seq"])
        seq = [r for i, r in enumerate(seq) if i == 0 or seq[i - 1]["node"] != r["node"]]     # 같은 정류장이 잇달아 적힌 줄은 하나로
        for i, r in enumerate(seq):
            node = r["node"]
            stops.setdefault(node, {"ars": r["ars"], "name": r["name"], "lat": round(r["y"], 6), "lon": round(r["x"], 6)})
            prev = seq[i - 1]["name"] if i > 0 else None
            after_stop = seq[i + 1] if i + 1 < len(seq) else None
            nxt = after_stop["name"] if after_stop else None
            if prev is not None:
                before[node][prev] += 1
            if nxt is not None:
                after[node][nxt] += 1
            ways[node][bus_number(r["route"])].add((prev, nxt, bool(after_stop) and is_median(after_stop["node"], nxt, types)))
    for node, stop in stops.items():
        groups = collections.defaultdict(dict)                                  # (종류, 앞, 다음) → {버스 번호: 중앙차로로 가는가}
        for number, pairs in ways[node].items():
            for prev, nxt, median in pairs:
                seen = groups[(bus_kind(number), prev, nxt)]
                seen[number] = seen.get(number, False) or median
        median_of = {key: 2 * sum(seen.values()) >= len(seen) for key, seen in groups.items()}
        # 종류 순서 → 중앙차로로 가는 묶음 → 버스가 많은 묶음 → 이름 순 (실행할 때마다 같은 결과가 나오게)
        order = sorted(groups, key=lambda k: (KINDS.index(k[0]), not median_of[k], -len(groups[k]), k[1] or "", k[2] or ""))
        stop["prev"] = most_voted(before[node])
        stop["next"] = most_voted(after[node])
        stop["buses"] = [{"kind": key[0], "numbers": sorted(groups[key], key=number_order), "prev": key[1], "next": key[2],
                          "nextMedian": median_of[key]} for key in order]
    return stops


def index_by_ars(table: dict) -> dict[str, list[str]]:
    """정류장 번호(ARS_ID) → NODE_ID 목록. stop_at 이 poi_id 로 못 찾을 때 쓴다"""
    out = collections.defaultdict(list)
    for node, stop in table.items():
        if stop.get("ars"):
            out[stop["ars"]].append(node)
    return dict(out)


def stop_at(table: dict, poi_id, ars=None, lat=None, lon=None, by_ars=None, within_m: float = SAME_STOP_M):
    """지식베이스의 정류장 → {"prev", "next", "buses"}. 자료에 없는 정류장이면 None. buses 의 묶음마다 그 버스들의 prev·next 가 있다

    poi_id 가 'BUS_<NODE_ID>' 면 바로 찾는다. 아니면 정류장 번호가 같고 좌표가 within_m 안인 곳을 찾는다
    (다섯 자리 번호는 지역이 다르면 겹칠 수 있어서 좌표를 함께 본다).
    """
    found = table.get(str(poi_id or "").removeprefix("BUS_"))
    if found is None and ars and by_ars and lat is not None and lon is not None:
        near = [(meters(lat, lon, table[n]["lat"], table[n]["lon"]), n) for n in by_ars.get(str(ars).strip(), ())]
        near = [pair for pair in near if pair[0] <= within_m]
        if near:
            found = table[min(near)[1]]
    if found is None:
        return None
    return {"prev": found["prev"], "next": found["next"], "buses": [dict(b, numbers=list(b["numbers"])) for b in found["buses"]]}


def report(rows: list[dict], table: dict) -> None:
    """눈으로 확인할 것: 종류별 노선 수, 버스마다 앞·다음이 갈리는 정류장 수, 한 묶음에 번호가 가장 많은 정류장"""
    routes = {r["route_id"]: bus_number(r["route"]) for r in rows}
    kinds = collections.Counter(bus_kind(n) for n in set(routes.values()))
    print("노선 수:", len(routes), "| 종류별 번호 수:", {k: kinds[k] for k in KINDS if kinds[k]})
    other = sorted(n for n in set(routes.values()) if bus_kind(n) == "OTHER")
    print("OTHER 로 간 번호:", other)
    print("정류장 수:", len(table), "| 앞 없음:", sum(1 for s in table.values() if s["prev"] is None),
          "| 다음 없음:", sum(1 for s in table.values() if s["next"] is None))
    split = sum(1 for s in table.values() if len({(b["prev"], b["next"]) for b in s["buses"]}) > 1)
    sizes = collections.Counter(min(len(s["buses"]), 4) for s in table.values())
    print("버스마다 앞·다음이 갈리는 정류장:", split, "| 묶음 수별 정류장 (4 는 4개 이상):", dict(sorted(sizes.items())))
    print("다음 정류장이 중앙차로인 묶음이 있는 정류장:", sum(1 for s in table.values() if any(b["nextMedian"] for b in s["buses"])))
    most = max(((len(b["numbers"]), s["name"], b["kind"]) for s in table.values() for b in s["buses"]), default=None)
    print("한 묶음에 번호가 가장 많은 곳:", most)
    print("이름이 가장 긴 정류장:", sorted({s["name"] for s in table.values()}, key=len)[-5:])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--routes", required=True, help="서울시버스노선별정류소정보 (XLSX 또는 CSV)")
    ap.add_argument("--stops", default=None, help="서울시 버스정류소 위치정보 (XLSX 또는 CSV). 정류소타입 열로 중앙차로 정류장을 가린다")
    ap.add_argument("--out", default="~/data/kb_seoul", help="stop_routes.json 을 둘 지식베이스 폴더")
    ap.add_argument("--report", action="store_true", help="종류별 노선 수 등 확인할 것을 출력한다")
    args = ap.parse_args()
    rows = read_routes(args.routes)
    table = build(rows, read_stop_types(args.stops) if args.stops else None)
    if args.report:
        report(rows, table)
    path = os.path.join(os.path.expanduser(args.out), "stop_routes.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(table, f, ensure_ascii=False, indent=0)
    print(f"wrote {path}: {len(table)} stops, {len({r['route_id'] for r in rows})} routes")


if __name__ == "__main__":
    main()
