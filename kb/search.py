"""하이브리드 장소 검색: 자모·발음 편집거리 + 문장 임베딩 + 키오스크 거리.

score = w_jamo · str_sim + w_emb · emb_sim + w_geo · geo_score   (각 0~1)
  str_sim  : max(rapidfuzz ratio(자모), 0.95 × ratio(발음 키)) / 100   — 오인식(선능력→선릉역)에 강하게
  emb_sim  : 코사인 유사도 (정규화 임베딩 내적). 후보 전부에 대해 계산한다
  geo_score: 1 - min(거리, radius) / radius  (키오스크 좌표가 없으면 0)

usage (스크립트로):
  python search.py --kb ~/data/kb "서울대병언" --kiosk-x 126.99 --kiosk-y 37.57
"""
import argparse
import heapq
import json
import math
import os
import re
import sqlite3
import sys
import threading

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from normalize import normalize_name, to_jamo, to_phonetic  # noqa: E402


def haversine_m(x1, y1, x2, y2):
    r = 6371000.0
    p1, p2 = math.radians(y1), math.radians(y2)
    dp, dl = math.radians(y2 - y1), math.radians(x2 - x1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def station_number(poi_id: str) -> str:
    """지하철역의 역 번호. 'SUB_0130_1호선' → '0130' (역 번호가 없는 자료로 만든 역은 '')"""
    m = re.match(r"SUB_([0-9A-Za-z]+)_", str(poi_id))
    return m.group(1) if m else ""


def place_number(p: dict) -> str:
    """사람이 읽는 번호: 지하철역은 역 번호('130'), 버스정류장은 정류장 번호('01-013'). 없으면 ''"""
    if p.get("poi_type") == "SUBWAY_STATION":
        number = station_number(p.get("poi_id", ""))
        return number.lstrip("0") or number
    ars = str(p.get("ars_id") or "").strip()
    return f"{ars[:2]}-{ars[2:]}" if len(ars) == 5 and ars.isdigit() else ars


class TransitKB:
    def __init__(self, kb_dir, weights=(0.5, 0.3, 0.2), geo_radius_m=5000.0, use_embedding=True):
        self.dir = os.path.expanduser(kb_dir)
        self.w_str, self.w_emb, self.w_geo = weights
        self.radius = geo_radius_m
        # 읽기 전용. FastAPI 가 스레드풀에서 호출해도 되도록 스레드 검사를 끄고 락으로 직렬화한다
        self.con = sqlite3.connect(os.path.join(self.dir, "transit.db"), check_same_thread=False)
        self.con.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        # 표기(term) → poi_id 목록. 같은 이름의 정류장이 여럿이라 표기 단위로 비교해야 후보가 중복으로 차지 않는다
        self.term_to_pois = {}
        self.exact_only = set()   # 정확히 같을 때만 후보가 되는 표기 (통칭·옛 이름·괄호 부기). 비슷한 말 찾기에서는 뺀다
        with open(os.path.join(self.dir, "terms.jsonl"), encoding="utf-8") as f:
            for line in f:
                o = json.loads(line)
                self.term_to_pois.setdefault(o["term"], set()).add(o["poi_id"])
                if o.get("exact_only"):
                    self.exact_only.add(o["term"])
        self.uniq = sorted(self.term_to_pois)          # build_kb.py 의 terms_uniq.json 과 같은 순서
        self.term_index = {t: i for i, t in enumerate(self.uniq)}
        self.jamo_list = [to_jamo(t) for t in self.uniq]
        self.phon_list = [to_phonetic(t) for t in self.uniq]
        self.index = None
        self.model = None
        faiss_path = os.path.join(self.dir, "terms.faiss")
        if use_embedding and os.path.exists(faiss_path):
            import faiss
            self.index = faiss.read_index(faiss_path)
            with open(os.path.join(self.dir, "terms_uniq.json"), encoding="utf-8") as f:
                saved = json.load(f)
            if saved != self.uniq:
                raise RuntimeError("terms_uniq.json 과 terms.jsonl 이 맞지 않습니다. build_kb.py 를 다시 실행하세요.")
            meta = json.load(open(os.path.join(self.dir, "meta.json"), encoding="utf-8"))
            self.model_name = meta.get("embedding_model") or "jhgan/ko-sroberta-multitask"
        self._poi_cache = {}
        self._all_pois = None    # nearest_any 가 처음 불릴 때 한 번 읽어 둔다
        # 역의 노선과 앞·다음 역 (station_lines.py 가 만든다). 파일이 없으면 빈 표라서 위치 응답의 place.lines 가 비어 간다
        self.station_lines = {}
        lines_path = os.path.join(self.dir, "station_lines.json")
        if os.path.exists(lines_path):
            with open(lines_path, encoding="utf-8") as f:
                self.station_lines = json.load(f)

    def _model(self):
        if self.model is None:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(self.model_name)
        return self.model

    def poi(self, poi_id):
        if poi_id not in self._poi_cache:
            with self._lock:
                r = self.con.execute("SELECT * FROM transit_poi WHERE poi_id=?", (poi_id,)).fetchone()
            self._poi_cache[poi_id] = dict(r) if r else None
        return self._poi_cache[poi_id]

    def nearest(self, kiosk_xy, poi_type="SUBWAY_STATION", limit=12):
        """키오스크에서 가까운 순으로 장소를 돌려준다. 같은 이름(노선만 다른 역)은 가장 가까운 하나만."""
        with self._lock:
            rows = [dict(r) for r in self.con.execute("SELECT * FROM transit_poi WHERE poi_type=?", (poi_type,))]
        for r in rows:
            r["distance_m"] = int(haversine_m(kiosk_xy[0], kiosk_xy[1], r["x"], r["y"]))
        rows.sort(key=lambda r: r["distance_m"])
        seen, out = set(), []
        for r in rows:
            key = r["name_norm"][:-1] if r["name_norm"].endswith("역") and len(r["name_norm"]) > 2 else r["name_norm"]
            if key in seen:
                continue
            seen.add(key)
            out.append(r)
            if len(out) >= limit:
                break
        return out

    def find_places(self, query, limit=20):
        """역 번호·정류장 번호 또는 이름으로 역·정류장을 찾는다. 설정에서 키오스크가 놓인 곳을 직접 정할 때 쓴다.

        숫자만 있으면 번호로 본다: 정류장 번호('01013', '01-013')와 역 번호('130', '0130').
        네 자리 이하면 둘 다 찾고, 줄표가 있거나 다섯 자리면 정류장 번호로만 찾는다.
        그 밖에는 이름에 그 글자가 들어 있는 곳 ('종로3가', '종로3가역', '탑골공원').
        이름이 꼭 같은 곳, 지하철역, 이름 순으로 돌려준다. 말을 알아듣는 검색(search)과 달리 비슷한 이름은 찾지 않는다.
        """
        q = str(query or "").strip()
        if not q:
            return []
        digits = re.sub(r"[\s\-]", "", q)
        with self._lock:
            if digits.isdigit():
                stops = [dict(r) for r in self.con.execute(
                    "SELECT * FROM transit_poi WHERE poi_type='BUS_STOP' AND ars_id IN (?, ?)", (digits, digits.zfill(5)))]
                # 줄표가 있거나 다섯 자리면 정류장 번호로만 본다 ('01-013' 이 역 번호 1013 과 섞이지 않게)
                stations = [] if "-" in q or len(digits) >= 5 else [
                    dict(r) for r in self.con.execute("SELECT * FROM transit_poi WHERE poi_type='SUBWAY_STATION'")]
                number = digits.lstrip("0")
                rows = [r for r in stations if number and station_number(r["poi_id"]).lstrip("0") == number] + stops
                key = None
            else:
                key = normalize_name(q)
                keys = {key, key[:-1] if key.endswith("역") and len(key) > 2 else key,
                        key[:-3] if key.endswith("정류장") and len(key) > 4 else key} - {""}
                rows = {}
                for k in keys:
                    for r in self.con.execute("SELECT * FROM transit_poi WHERE poi_type IN ('SUBWAY_STATION', 'BUS_STOP') "
                                              "AND name_norm LIKE ?", (f"%{k}%",)):
                        rows[r["poi_id"]] = dict(r)
                rows = list(rows.values())
                key = min(keys, key=len)
        rows.sort(key=lambda r: (key is not None and r["name_norm"] not in (key, key + "역"), r["poi_type"] != "SUBWAY_STATION",
                                 r["name_norm"], r["poi_id"]))
        return rows[: max(1, int(limit))]

    def nearest_any(self, xy, limit=1):
        """종류(정류장·역)를 가리지 않고 가까운 순으로 장소를 돌려준다. 현재 위치를 가장 가까운 정류장·역에 맞출 때 쓴다.
        종류와 이름이 같은 곳(길 양쪽 정류장 등)은 가장 가까운 하나만 남긴다."""
        if self._all_pois is None:
            with self._lock:
                rows = [dict(r) for r in self.con.execute("SELECT * FROM transit_poi")]
            self._all_pois = [r for r in rows if r.get("x") is not None and r.get("y") is not None]
        near = heapq.nsmallest(max(limit * 6, 12), self._all_pois,
                               key=lambda r: haversine_m(xy[0], xy[1], r["x"], r["y"]))
        seen, out = set(), []
        for r in near:
            key = (r["poi_type"], r["name_norm"])
            if key in seen:
                continue
            seen.add(key)
            out.append({**r, "distance_m": int(haversine_m(xy[0], xy[1], r["x"], r["y"]))})
            if len(out) >= limit:
                break
        return out

    def search(self, query, kiosk_xy=None, k=5, str_limit=150, emb_limit=30):
        from rapidfuzz import fuzz, process
        q = normalize_name(query)
        if not q:
            return []
        qj, qp = to_jamo(q), to_phonetic(q)

        # 1) 문자열 유사도 후보 (자모, 발음 키 각각 상위 str_limit 표기)
        term_sim = {}
        for _, score, idx in process.extract(qj, self.jamo_list, scorer=fuzz.ratio, limit=str_limit):
            term_sim[self.uniq[idx]] = max(term_sim.get(self.uniq[idx], 0.0), score / 100)
        for _, score, idx in process.extract(qp, self.phon_list, scorer=fuzz.ratio, limit=str_limit):
            term_sim[self.uniq[idx]] = max(term_sim.get(self.uniq[idx], 0.0), 0.92 * score / 100)

        # 2) 임베딩: 질의 벡터 1회 계산 → 임베딩 상위 후보 추가 + 모든 후보의 코사인 유사도
        emb_sim = {}
        if self.index is not None:
            import numpy as np
            v = self._model().encode([q], normalize_embeddings=True, convert_to_numpy=True).astype("float32")
            sims, idxs = self.index.search(v, emb_limit)
            for s, i in zip(sims[0], idxs[0]):
                if i >= 0:
                    t = self.uniq[i]
                    emb_sim[t] = float(s)
                    if t not in term_sim:
                        term_sim[t] = max(fuzz.ratio(qj, self.jamo_list[i]), 0.92 * fuzz.ratio(qp, self.phon_list[i])) / 100
            for t in term_sim:
                if t not in emb_sim:
                    vec = self.index.reconstruct(self.term_index[t])
                    emb_sim[t] = float(np.dot(v[0], vec))

        # 통칭·옛 이름 같은 표기는 질의와 정확히 같을 때만 후보로 남긴다 ('설렁역' 이 '성내역' 으로 끌려가는 것을 막는다)
        if self.exact_only:
            term_sim = {t: s for t, s in term_sim.items() if s >= 0.999 or t not in self.exact_only}

        # 3) 표기 → POI 전개, 종합 점수
        results = []
        for t, ssim in term_sim.items():
            es = max(0.0, emb_sim.get(t, 0.0))
            jamo_only = fuzz.ratio(qj, self.jamo_list[self.term_index[t]]) / 100  # 발음 키 없이 순수 자모 유사도 (치환 안전장치용)
            for pid in self.term_to_pois[t]:
                p = self.poi(pid)
                if not p:
                    continue
                dist, geo = None, 0.0
                if kiosk_xy:
                    dist = haversine_m(kiosk_xy[0], kiosk_xy[1], p["x"], p["y"])
                    geo = max(0.0, 1.0 - min(dist, self.radius) / self.radius)
                score = self.w_str * ssim + self.w_emb * es + self.w_geo * geo
                if q == p["name_norm"] or q == t:
                    score += 0.1
                results.append({
                    "poi_id": pid, "name": p["name"], "poi_type": p["poi_type"], "line_info": p["line_info"],
                    "x": p["x"], "y": p["y"], "region": p["region"],
                    "distance_m": None if dist is None else int(dist),
                    "score": round(min(score, 1.0), 4), "matched": t,
                    "jamo_sim": round(ssim, 3), "jamo_only": round(jamo_only, 3), "emb_sim": round(es, 3),
                })
        results.sort(key=lambda r: (-r["score"], r["distance_m"] if r["distance_m"] is not None else 0))
        # 같은 이름·같은 유형(상/하행 정류장 등)은 가장 점수 높은(가까운) 하나만
        seen, dedup = set(), []
        for r in results:
            key = (r["name"], r["poi_type"])
            if key in seen:
                continue
            seen.add(key)
            dedup.append(r)
            if len(dedup) >= k:
                break
        return dedup


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--kb", default="~/data/kb")
    ap.add_argument("--kiosk-x", type=float)
    ap.add_argument("--kiosk-y", type=float)
    ap.add_argument("-k", type=int, default=5)
    ap.add_argument("--no-embedding", action="store_true")
    args = ap.parse_args()
    kb = TransitKB(args.kb, use_embedding=not args.no_embedding)
    xy = (args.kiosk_x, args.kiosk_y) if args.kiosk_x and args.kiosk_y else None
    for r in kb.search(args.query, xy, k=args.k):
        print(f"{r['score']:.3f}  {r['poi_type']:14s} {r['name']:20s} {r['line_info'][:20]:20s} "
              f"d={r['distance_m']}  (str {r['jamo_sim']}, emb {r['emb_sim']}, via '{r['matched']}')")


if __name__ == "__main__":
    main()
