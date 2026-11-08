"""지식베이스 검색 데모: 오인식 예시 여러 개를 한 번에 조회한다.

usage: python demo_search.py --kb ~/data/kb --kiosk-x 126.9918 --kiosk-y 37.5704 [질의 ...]
질의를 안 주면 기본 예시(기준선 평가에서 나온 오인식)를 쓴다.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from search import TransitKB  # noqa: E402

DEFAULT = ["서울대병언", "선능력", "성능력", "청량리", "단공기", "잠시랑", "안개학과", "종로삼가", "경동시장",
           "도곡초등학교", "노원역", "양재", "서울역", "강남 터미널"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("queries", nargs="*")
    ap.add_argument("--kb", default="~/data/kb")
    ap.add_argument("--kiosk-x", type=float, default=None)
    ap.add_argument("--kiosk-y", type=float, default=None)
    ap.add_argument("-k", type=int, default=3)
    ap.add_argument("--no-embedding", action="store_true")
    ap.add_argument("--weights", default="0.8,0.1,0.1", help="문자열, 임베딩, 거리 가중치 (config.yaml rag.weights 와 맞출 것)")
    ap.add_argument("--radius", type=float, default=20000)
    args = ap.parse_args()
    weights = tuple(float(w) for w in args.weights.split(","))
    kb = TransitKB(args.kb, weights=weights, geo_radius_m=args.radius, use_embedding=not args.no_embedding)
    xy = (args.kiosk_x, args.kiosk_y) if args.kiosk_x is not None and args.kiosk_y is not None else None
    import time
    for q in (args.queries or DEFAULT):
        t0 = time.time()
        res = kb.search(q, xy, k=args.k)
        print(f"\n[{q}]  ({(time.time()-t0)*1000:.0f} ms)")
        for r in res:
            print(f"  {r['score']:.3f}  {r['poi_type']:14s} {r['name']:18s} {r['line_info'][:16]:16s} "
                  f"d={r['distance_m']}  jamo {r['jamo_sim']:.2f} emb {r['emb_sim']:.2f}  via '{r['matched']}'")


if __name__ == "__main__":
    main()
