"""교통 지식베이스 구축: 공공데이터 → SQLite(transit_poi, poi_alias) + 임베딩 색인(FAISS) + 자모 색인.

입력 (모두 선택, 하나 이상):
  --bus       국토교통부_전국 버스정류장 위치정보 (CSV; 정류장번호, 정류장명, 위도, 경도, 도시명, 관리도시명 ...)
  --bus-seoul 서울시 버스정류소 위치정보 (XLSX; NODE_ID, ARS_ID, 정류소명, X좌표, Y좌표, 정류소타입).
              전국 파일에는 서울 정류장이 일부만 있어서 함께 넣는다. 겹치는 정류장은 서울시 파일 쪽을 남긴다
  --subway    전국도시철도역사정보표준데이터 (XLSX/CSV; 역사명, 노선명, 역위도, 역경도, 운영기관명 ...)
  --facility  직접 만든 주요 시설 목록 (CSV; name, x, y, region, aliases(세미콜론 구분))
  --regions   포함할 지역 키워드 (쉼표). 버스는 도시명/관리도시명, 지하철은 역 주소와 부분 일치. 기본: 서울
  --out       출력 폴더 (기본 ~/data/kb)

열 이름은 부분 일치로 찾으므로 파일 버전이 조금 달라도 동작한다. 찾은 열을 출력하니 확인할 것.
usage:
  python build_kb.py --bus 전국버스정류장.csv --bus-seoul 서울시버스정류소.xlsx --subway 도시철도역사정보.xlsx --out ~/data/kb_seoul
"""
import argparse
import csv
import io
import json
import os
import sqlite3
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from normalize import make_aliases, normalize_name, to_jamo  # noqa: E402

DEFAULT_REGIONS = "서울"   # MVP 는 서울 소재만. 수도권으로 넓히려면 --regions 서울,인천,경기
ALL_NAMES: set = set()     # 지역 필터와 무관한 전국 역·정류장 이름 (서울 밖 실제 지명을 오보정하지 않기 위한 목록)
ALL_STATION_NAMES: set = set()   # 그중 도시철도 역 이름만 ('수원역 가려면' → 안내 범위 밖으로 알리는 데 쓴다)


# ------------------------------------------------------------ file reading
def read_table(path):
    """CSV(cp949/utf-8 자동) 또는 XLSX → (header list, rows list[list[str]])"""
    path = os.path.expanduser(path)
    if path.lower().endswith((".xlsx", ".xlsm")):
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb[wb.sheetnames[0]]
        rows = [["" if v is None else str(v) for v in r] for r in ws.iter_rows(values_only=True)]
        rows = [r for r in rows if any(c.strip() for c in r)]
        return rows[0], rows[1:]
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "cp949", "euc-kr", "utf-8"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError(f"인코딩을 알 수 없음: {path}")
    rows = list(csv.reader(io.StringIO(text)))
    rows = [r for r in rows if any(c.strip() for c in r)]
    return rows[0], rows[1:]


def find_col(header, *keywords, required=True):
    """header 에서 키워드 중 하나를 포함하는 첫 열 인덱스 (공백·밑줄·대소문자 무시: NODE_ID == nodeid)"""
    def n(s):
        return str(s).replace(" ", "").replace("_", "").lower()

    norm = [n(h) for h in header]
    for kw in keywords:
        for i, h in enumerate(norm):
            if n(kw) in h:
                return i
    if required:
        raise KeyError(f"열을 찾을 수 없음: {keywords} / header={header}")
    return None


def to_float(s):
    try:
        return float(str(s).strip())
    except ValueError:
        return None


# ------------------------------------------------------------ loaders
EXCLUDE_STOP_TYPES = {"한강선착장", "가상정류장"}   # 버스 정류장이 아닌 유형 (서울시 파일의 정류소타입)


def load_bus(path, regions, default_city="", source="national"):
    """버스정류장 파일 적재. 두 형식을 열 이름으로 구분한다.
    - 국토교통부 전국 파일: 정류장번호, 정류장명, 위도, 경도, 모바일단축번호, 도시명, 관리도시명
    - 서울시 버스정류소 위치정보: NODE_ID, ARS_ID, 정류소명, X좌표, Y좌표, 정류소타입 (도시 열 없음 → default_city)
    """
    header, rows = read_table(path)
    ci = {
        "id": find_col(header, "정류장번호", "정류소번호", "nodeid"),
        "name": find_col(header, "정류장명", "정류소명", "nodenm", "sttnnm"),
        "y": find_col(header, "위도", "gpslati", "Y좌표", "crdnty"),
        "x": find_col(header, "경도", "gpslong", "X좌표", "crdntx"),
        "city": find_col(header, "도시명", "관리도시명", required=False),
        "mcity": find_col(header, "관리도시명", required=False),
        "ars": find_col(header, "모바일단축번호", "arsid", "sttnno", required=False),
        "type": find_col(header, "정류소타입", "정류소유형", "sttnty", required=False),
    }
    print(f"bus[{source}] columns:", {k: (header[v] if v is not None else None) for k, v in ci.items()})
    out, skipped, excluded = [], 0, 0
    for r in rows:
        if len(r) <= max(v for v in ci.values() if v is not None):
            skipped += 1
            continue
        if ci["city"] is None and ci["mcity"] is None:
            city = default_city
        else:
            city = (r[ci["city"]] if ci["city"] is not None else "") + " " + (r[ci["mcity"]] if ci["mcity"] is not None else "")
        if ci["type"] is not None and r[ci["type"]].strip() in EXCLUDE_STOP_TYPES:
            excluded += 1
            continue
        nm = normalize_name(r[ci["name"]])
        if nm:
            ALL_NAMES.add(nm)
        if regions and not any(k in city for k in regions):
            continue
        x, y = to_float(r[ci["x"]]), to_float(r[ci["y"]])
        name = r[ci["name"]].strip()
        if not name or x is None or y is None or not (124 < x < 132 and 33 < y < 39):
            skipped += 1
            continue
        out.append({
            "poi_id": f"BUS_{r[ci['id']].strip()}", "name": name, "poi_type": "BUS_STOP",
            "line_info": "", "ars_id": r[ci["ars"]].strip() if ci["ars"] is not None else "",
            "x": x, "y": y, "region": city.strip(), "source": source,
        })
    print(f"bus[{source}]: {len(out)} kept, {skipped} skipped, {excluded} excluded by type")
    return out


def drop_cross_source_duplicates(pois, primary="seoul", radius_m=100.0):
    """같은 정류장이 두 파일에 다 있으면 primary 쪽만 남긴다 (이름이 같고 radius_m 안).
    같은 파일 안의 상·하행 정류장은 서로 다른 정류장이므로 그대로 둔다."""
    import math

    def dist(a, b):
        kx = 111320.0 * math.cos(math.radians((a["y"] + b["y"]) / 2))
        return math.hypot((a["x"] - b["x"]) * kx, (a["y"] - b["y"]) * 110540.0)

    by_name = {}
    for p in pois:
        if p["poi_type"] == "BUS_STOP" and p.get("source") == primary:
            by_name.setdefault(normalize_name(p["name"]), []).append(p)
    kept, dropped = [], 0
    for p in pois:
        if p["poi_type"] == "BUS_STOP" and p.get("source") != primary:
            same = by_name.get(normalize_name(p["name"]), ())
            if any(dist(p, q) <= radius_m for q in same):
                dropped += 1
                continue
        kept.append(p)
    if dropped:
        print(f"dropped {dropped} duplicates already present in the {primary} file")
    return kept


def load_subway(path, regions):
    header, rows = read_table(path)
    ci = {
        "id": find_col(header, "역번호", "역사번호", "역코드", required=False),
        "name": find_col(header, "역사명", "역명"),
        "line": find_col(header, "노선명", "호선"),
        "y": find_col(header, "역위도", "위도"),
        "x": find_col(header, "역경도", "경도"),
        "op": find_col(header, "운영기관", required=False),
        "addr": find_col(header, "도로명주소", "주소", required=False),
        "transfer": find_col(header, "환승역구분", required=False),
        "xlines": find_col(header, "환승노선명", required=False),
    }
    print("subway columns:", {k: (header[v] if v is not None else None) for k, v in ci.items()})
    out, skipped = [], 0
    for i, r in enumerate(rows):
        if len(r) <= max(v for v in ci.values() if v is not None):
            skipped += 1
            continue
        # 소재지 기준: 주소가 있으면 주소로만 판단 (운영기관명 '서울교통공사'인 경기 구간 역을 제외하기 위해)
        if ci["addr"] is not None and r[ci["addr"]].strip():
            region_text = r[ci["addr"]]
        else:
            region_text = r[ci["op"]] if ci["op"] is not None else ""
        nm = normalize_name(r[ci["name"]])
        if nm:
            other = nm + "역" if not nm.endswith("역") else nm[:-1]
            ALL_NAMES.update((nm, other))
            ALL_STATION_NAMES.update((nm, other))
        if regions and not any(k in region_text for k in regions):
            continue
        x, y = to_float(r[ci["x"]]), to_float(r[ci["y"]])
        name = r[ci["name"]].strip()
        if not name or x is None or y is None or not (124 < x < 132 and 33 < y < 39):
            skipped += 1
            continue
        line = r[ci["line"]].strip()
        rid = r[ci["id"]].strip() if ci["id"] is not None and r[ci["id"]].strip() else f"{i}"
        info = line
        if ci["xlines"] is not None and r[ci["xlines"]].strip():
            info += " / 환승: " + r[ci["xlines"]].strip()
        out.append({
            "poi_id": f"SUB_{rid}_{normalize_name(line)}", "name": name, "poi_type": "SUBWAY_STATION",
            "line_info": info, "ars_id": "", "x": x, "y": y,
            "region": (r[ci["addr"]].strip() if ci["addr"] is not None else region_text).strip(),
        })
    print(f"subway: {len(out)} kept, {skipped} skipped")
    return out


def load_facility(path):
    header, rows = read_table(path)
    ci = {k: find_col(header, k) for k in ("name", "x", "y")}
    cr = find_col(header, "region", required=False)
    ca = find_col(header, "alias", required=False)
    out = []
    for i, r in enumerate(rows):
        x, y = to_float(r[ci["x"]]), to_float(r[ci["y"]])
        if x is None or y is None:
            continue
        out.append({
            "poi_id": f"FAC_{i+1:06d}", "name": r[ci["name"]].strip(), "poi_type": "FACILITY",
            "line_info": "", "ars_id": "", "x": x, "y": y,
            "region": r[cr].strip() if cr is not None else "",
            "extra_aliases": [a.strip() for a in r[ca].split(";")] if ca is not None and r[ca].strip() else [],
        })
    print(f"facility: {len(out)}")
    return out


# ------------------------------------------------------------ build
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bus", help="국토교통부 전국 버스정류장 위치정보 (CSV)")
    ap.add_argument("--bus-seoul", help="서울시 버스정류소 위치정보 (XLSX/CSV). 전국 파일과 겹치는 정류장은 이쪽을 남긴다")
    ap.add_argument("--subway")
    ap.add_argument("--facility")
    ap.add_argument("--extra-aliases", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "extra_aliases.csv"),
                    help="옛 이름·통칭 CSV (name, alias). name 과 정식 이름이 같은 POI 전부에 alias 를 붙인다")
    ap.add_argument("--regions", default=DEFAULT_REGIONS)
    ap.add_argument("--common-words-from", nargs="*", default=[],
                    help="전사 TSV(text 열) 목록. 자주 나오는 일반 단어를 common_words.json 으로 저장해 장소 오인을 막는다 (커밋 금지)")
    ap.add_argument("--common-min-count", type=int, default=30)
    ap.add_argument("--out", default="~/data/kb")
    ap.add_argument("--embedding-model", default="jhgan/ko-sroberta-multitask")
    ap.add_argument("--no-embedding", action="store_true", help="임베딩 색인 생략 (자모 검색만)")
    args = ap.parse_args()
    if not (args.bus or args.bus_seoul or args.subway or args.facility):
        sys.exit("--bus / --bus-seoul / --subway / --facility 중 하나 이상 필요")
    regions = [r.strip() for r in args.regions.split(",") if r.strip()]
    out_dir = os.path.expanduser(args.out)
    os.makedirs(out_dir, exist_ok=True)

    pois = []
    if args.bus_seoul:
        pois += load_bus(args.bus_seoul, regions, default_city="서울특별시", source="seoul")
    if args.bus:
        pois += load_bus(args.bus, regions, source="national")
    if args.bus_seoul and args.bus:
        pois = drop_cross_source_duplicates(pois, primary="seoul")
    if args.subway:
        pois += load_subway(args.subway, regions)
    if args.facility:
        pois += load_facility(args.facility)
    if not pois:
        sys.exit("POI 가 없습니다. --regions 또는 파일을 확인하세요.")

    # 옛 이름·통칭 (예: 당고개 → 불암산으로 역명 변경)
    extra = {}
    if args.extra_aliases and os.path.exists(os.path.expanduser(args.extra_aliases)):
        header, rows = read_table(args.extra_aliases)
        cn, ca = find_col(header, "name"), find_col(header, "alias")
        for r in rows:
            if len(r) > max(cn, ca) and r[cn].strip() and r[ca].strip():
                extra.setdefault(normalize_name(r[cn]), set()).add(normalize_name(r[ca]))
        print(f"extra aliases: {sum(len(v) for v in extra.values())} for {len(extra)} names")

    # 별칭
    alias_rows = []
    for p in pois:
        p["name_norm"] = normalize_name(p["name"])
        p["name_jamo"] = to_jamo(p["name"])
        aliases = make_aliases(p["name"], p["poi_type"]) | set(p.pop("extra_aliases", []))
        # "불암산(당고개)" 처럼 괄호 안에 옛 이름이 있는 경우도 있으니 괄호 제거형과 원형 둘 다로 조회
        for key in {p["name_norm"], normalize_name(p["name"].split("(")[0])}:
            for a in extra.get(key, ()):
                aliases.add(a)
                if p["poi_type"] == "SUBWAY_STATION" and not a.endswith("역"):
                    aliases.add(a + "역")
        for a in aliases:
            alias_rows.append((p["poi_id"], a, to_jamo(a)))
    print(f"pois: {len(pois)}  aliases: {len(alias_rows)}")

    # SQLite (API 명세 5장 테이블)
    db_path = os.path.join(out_dir, "transit.db")
    if os.path.exists(db_path):
        os.remove(db_path)
    con = sqlite3.connect(db_path)
    con.executescript("""
        CREATE TABLE transit_poi (poi_id TEXT PRIMARY KEY, name TEXT, name_norm TEXT, name_jamo TEXT,
            poi_type TEXT, line_info TEXT, ars_id TEXT, x REAL, y REAL, region TEXT);
        CREATE TABLE poi_alias (alias_id INTEGER PRIMARY KEY AUTOINCREMENT, poi_id TEXT, alias TEXT,
            alias_jamo TEXT, alias_type TEXT);
        CREATE INDEX idx_poi_norm ON transit_poi(name_norm);
        CREATE INDEX idx_alias ON poi_alias(alias);
        CREATE INDEX idx_alias_poi ON poi_alias(poi_id);
    """)
    con.executemany("INSERT OR REPLACE INTO transit_poi VALUES (?,?,?,?,?,?,?,?,?,?)",
                    [(p["poi_id"], p["name"], p["name_norm"], p["name_jamo"], p["poi_type"], p["line_info"],
                      p["ars_id"], p["x"], p["y"], p["region"]) for p in pois])
    con.executemany("INSERT INTO poi_alias (poi_id, alias, alias_jamo, alias_type) VALUES (?,?,?,'AUTO')", alias_rows)
    con.commit()

    # 검색 단위: (표기, poi_id) — 이름 + 별칭 전부. 자모 문자열과 함께 저장
    terms = [(p["name_norm"], p["poi_id"], p["name_jamo"]) for p in pois] + [(a, pid, j) for pid, a, j in alias_rows]
    with open(os.path.join(out_dir, "terms.jsonl"), "w", encoding="utf-8") as f:
        for t, pid, j in terms:
            f.write(json.dumps({"term": t, "poi_id": pid, "jamo": j}, ensure_ascii=False) + "\n")

    # 임베딩 색인: 중복 이름은 한 번만 임베딩 (이름 → poi 목록은 terms.jsonl 로 복원)
    if not args.no_embedding:
        import faiss
        from sentence_transformers import SentenceTransformer
        uniq = sorted({t for t, _, _ in terms})
        print(f"embedding {len(uniq)} unique terms with {args.embedding_model} ...", flush=True)
        t0 = time.time()
        model = SentenceTransformer(args.embedding_model)
        emb = model.encode(uniq, batch_size=256, normalize_embeddings=True, show_progress_bar=True,
                           convert_to_numpy=True).astype("float32")
        index = faiss.IndexFlatIP(emb.shape[1])
        index.add(emb)
        faiss.write_index(index, os.path.join(out_dir, "terms.faiss"))
        with open(os.path.join(out_dir, "terms_uniq.json"), "w", encoding="utf-8") as f:
            json.dump(uniq, f, ensure_ascii=False)
        print(f"embedding done in {time.time()-t0:.0f}s, dim {emb.shape[1]}")

    # 전국 이름 목록: 지역 밖(수원역, 부평역 …)이라 지식베이스엔 없지만 실제 있는 이름 → RAG 가 다른 역으로 바꾸지 않게
    kb_term_set = {t for t, _, _ in terms}
    national = sorted(n for n in ALL_NAMES if n not in kb_term_set and len(n) >= 2)
    with open(os.path.join(out_dir, "national_names.json"), "w", encoding="utf-8") as f:
        json.dump(national, f, ensure_ascii=False)
    stations_outside = sorted(n for n in ALL_STATION_NAMES if n not in kb_term_set and len(n) >= 2)
    with open(os.path.join(out_dir, "national_stations.json"), "w", encoding="utf-8") as f:
        json.dump(stations_outside, f, ensure_ascii=False)
    print(f"national names outside KB: {len(national)} (stations: {len(stations_outside)})")

    # 일반 단어 사전: 전사에 자주 나오지만 지식베이스 표기와 같지 않은 단어 (작동, 역사, 도움 …)
    n_common = 0
    if args.common_words_from:
        import re
        import collections as _c
        particles = re.compile(r"(까지|으로|로|에서|에게|한테|이요|예요|이에요|은|는|이|가|을|를|에|요|도|행|방면|쪽)$")
        kb_terms = {t for t, _, _ in terms}
        cnt = _c.Counter()
        for tsv in args.common_words_from:
            header, rows = read_table(tsv)
            ti = find_col(header, "text")
            for r in rows:
                if len(r) > ti:
                    for w in r[ti].split():
                        core = particles.sub("", normalize_name(w))
                        if len(core) >= 2:
                            cnt[core] += 1
        # 실제 역·정류장 이름(지식베이스 표기 + 전국 이름)만 빼고 나머지는 일반 단어로 본다.
        # '전철역', '도착역' 처럼 '역'으로 끝나도 실제 이름이 아니면 일반 단어다
        common = sorted(w for w, c in cnt.items() if c >= args.common_min_count and w not in kb_terms
                        and w not in ALL_NAMES and re.search(r"[가-힣]", w))
        with open(os.path.join(out_dir, "common_words.json"), "w", encoding="utf-8") as f:
            json.dump(common, f, ensure_ascii=False)
        n_common = len(common)
        print(f"common words: {n_common} (count >= {args.common_min_count}, from {len(args.common_words_from)} files)")

    meta = {
        "built_at": time.strftime("%Y-%m-%d %H:%M"), "pois": len(pois), "aliases": len(alias_rows), "common_words": n_common,
        "by_type": {t: sum(1 for p in pois if p["poi_type"] == t) for t in ("BUS_STOP", "SUBWAY_STATION", "FACILITY")},
        "regions": regions, "embedding_model": None if args.no_embedding else args.embedding_model,
        "sources": {"bus": args.bus, "bus_seoul": args.bus_seoul, "subway": args.subway, "facility": args.facility},
    }
    with open(os.path.join(out_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(json.dumps(meta, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
