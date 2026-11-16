"""목적지 인식 정확도 평가 (문장 → /resolve → 목적지 후보).

멘토 피드백의 '대화 의도 인식 정확도'에 해당한다. 정식 역 이름이 아니라 구어·옛 이름·랜드마크·숫자·사투리로
말한 문장을 넣고, 1순위 후보(또는 3순위 안)가 기대한 곳인지 센다. 음성 없이 문장만으로 돌린다.

사례 파일(kb/data/destination_cases.csv): text, accept, category
  accept 는 | 로 구분한 허용 답. 그냥 쓰면 이름이 정확히 같아야 하고(역·정류장·괄호 제외), * 로 시작하면 포함이면 된다.
  @OUT  = 안내 범위 밖이라고 답해야 함 (후보를 내면 오답)
  @NONE = 목적지로 잡지 않아야 함 (네·아니요 같은 대화)

usage:  python stt/eval_destinations.py [--base http://localhost:8001] [--out runs/eval/destinations.json]
"""
import argparse
import collections
import csv
import json
import os
import re
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CASES = os.path.join(os.path.dirname(HERE), "kb", "data", "destination_cases.csv")


def core(name: str) -> str:
    n = re.sub(r"\(.*?\)", "", name or "").replace(" ", "")
    return re.sub(r"(역|정류장|정류소)$", "", n) if len(n) > 1 else n


def matches(cand: dict, accept: list[str]) -> bool:
    name = (cand.get("name") or "").replace(" ", "")
    shown = (cand.get("display_name") or "").replace(" ", "")
    for a in accept:
        if a.startswith("*"):
            if a[1:] in name or a[1:] in shown:
                return True
        elif core(a) in (core(name), core(shown)):
            return True
    return False


def resolve(base: str, text: str, kiosk: str) -> dict:
    body = json.dumps({"text": text, "kiosk_id": kiosk, "input_mode": "VOICE"}).encode("utf-8")
    req = urllib.request.Request(base + "/api/v1/resolve", data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode("utf-8"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8001")
    ap.add_argument("--cases", default=CASES)
    ap.add_argument("--kiosk", default="KIOSK_JONGNO_01")
    ap.add_argument("--out", default="")
    args = ap.parse_args()

    with open(args.cases, encoding="utf-8") as f:
        cases = list(csv.DictReader(f))
    total = collections.Counter()
    top1 = collections.Counter()
    top3 = collections.Counter()
    records = []
    for c in cases:
        accept = [a for a in c["accept"].split("|") if a]
        r = resolve(args.base, c["text"], args.kiosk)
        cands = (r.get("data") or {}).get("destination_candidates") or []
        code = (r.get("error") or {}).get("code")
        got = [x.get("display_name") or x.get("name") for x in cands]
        if accept == ["@OUT"]:
            ok1 = ok3 = (code == "OUT_OF_SCOPE") or (not cands and code == "NO_CANDIDATE")
        elif accept == ["@NONE"]:
            ok1 = ok3 = not cands
        else:
            ok1 = bool(cands) and matches(cands[0], accept)
            ok3 = any(matches(x, accept) for x in cands[:3])
        total[c["category"]] += 1
        top1[c["category"]] += ok1
        top3[c["category"]] += ok3
        records.append({**c, "top1": ok1, "top3": ok3, "got": got, "code": code,
                        "intent": (r.get("data") or {}).get("intent"), "need_confirm": (r.get("data") or {}).get("need_confirm")})

    n = sum(total.values())
    print(f"{'분류':8s} {'문장':>4s} {'1순위':>7s} {'3순위 안':>8s}")
    for cat in total:
        print(f"{cat:8s} {total[cat]:4d} {100 * top1[cat] / total[cat]:6.1f}% {100 * top3[cat] / total[cat]:7.1f}%")
    print(f"{'전체':8s} {n:4d} {100 * sum(top1.values()) / n:6.1f}% {100 * sum(top3.values()) / n:7.1f}%")
    print("\n틀린 문장 (1순위 기준):")
    for rec in records:
        if not rec["top1"]:
            mark = "△" if rec["top3"] else "✗"
            print(f"  {mark} [{rec['category']}] {rec['text']}  → {rec['got'] or rec['code'] or rec['intent']}  (기대: {rec['accept']})")
    if args.out:
        os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump({"total": n, "top1": sum(top1.values()), "top3": sum(top3.values()),
                       "by_category": {k: {"n": total[k], "top1": top1[k], "top3": top3[k]} for k in total},
                       "records": records}, f, ensure_ascii=False, indent=2)
        print("wrote", args.out)


if __name__ == "__main__":
    main()
