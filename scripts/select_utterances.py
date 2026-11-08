"""라벨 색인(tally_prefix.py 출력)과 대본 TSV(xlsx_dump.py 출력)를 합쳐, 원하는 발화만 고른다.

도메인·세부 도메인·의도·키워드 중 하나라도 맞으면 포함 (OR). 예:
  # 키오스크 '지하철' 도메인 전부
  python select_utterances.py --script kiosk_script.tsv --index kiosk_training_index.tsv \
      --script-base 21000 --domains 지하철 --out subway_training.tsv
  # AI로봇에서 버스·택시·정류장 관련 발화 (대본 번호 기준값은 로봇 라벨을 받아 확인한 뒤 지정)
  python select_utterances.py --script script_로봇.tsv --index robot_training_index.tsv \
      --script-base 11000 --intents "시내 버스,시외 버스,택시,버스 정류장 검색" --keywords "버스,정류장" --out bus_training.tsv

대본 TSV 열: sheet, (빈칸), No., 도메인, 세부 도메인, 의도, 문장  (xlsx_dump.py 형식)
색인 TSV 열: wav, script_no, seconds, speaker, text                (tally_prefix.py 형식)
파일명의 대본 번호 = script-base + No.  (키오스크: 21000 + No., 확인됨)
출력 TSV 열: wav, script_no, seconds, speaker, domain, subdomain, intent, text
"""
import argparse
import collections
import sys


def norm(s: str) -> str:
    return "".join(s.split()).replace(".", "").replace("?", "").replace("!", "")


def csv_set(s: str):
    return {x.strip() for x in s.split(",") if x.strip()} if s else set()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--script", required=True, help="xlsx_dump.py 가 만든 대본 TSV")
    ap.add_argument("--index", required=True, help="tally_prefix.py 가 만든 라벨 색인 TSV")
    ap.add_argument("--script-base", type=int, required=True, help="파일명 대본 번호 = base + No.")
    ap.add_argument("--domains", default="", help="쉼표 구분. 예: 지하철")
    ap.add_argument("--subdomains", default="", help="쉼표 구분. 예: 대중교통/숙박 정보")
    ap.add_argument("--intents", default="", help="쉼표 구분. 예: 시내 버스,시외 버스")
    ap.add_argument("--keywords", default="", help="쉼표 구분, 문장에 포함되면 선택. 예: 버스,정류장")
    ap.add_argument("--out", required=True, help="선택된 발화 TSV")
    ap.add_argument("--out-all", default="", help="(선택) 전체 발화에 도메인을 붙인 TSV")
    args = ap.parse_args()

    domains, subdomains = csv_set(args.domains), csv_set(args.subdomains)
    intents, keywords = csv_set(args.intents), csv_set(args.keywords)
    if not (domains or subdomains or intents or keywords):
        sys.exit("필터를 하나 이상 지정하세요 (--domains/--subdomains/--intents/--keywords)")

    scripts = {}
    with open(args.script, encoding="utf-8") as f:
        for line in f:
            cols = line.rstrip("\n").split("\t")
            if len(cols) < 7 or not cols[2].isdigit():
                continue
            scripts[int(cols[2])] = (cols[3], cols[4], cols[5], cols[6])
    print(f"scripts: {len(scripts)}, domains: {dict(collections.Counter(v[0] for v in scripts.values()))}")

    def selected(dom, sub, intent, text):
        return (dom in domains or sub in subdomains or intent in intents
                or any(k in text for k in keywords))

    hours = collections.defaultdict(float)
    files = collections.Counter()
    speakers = collections.defaultdict(set)
    sel_hours = collections.defaultdict(float)
    match = mismatch = unknown = n_sel = 0
    hdr = "wav\tscript_no\tseconds\tspeaker\tdomain\tsubdomain\tintent\ttext\n"
    fa = open(args.out_all, "w", encoding="utf-8") if args.out_all else None
    if fa:
        fa.write(hdr)
    with open(args.index, encoding="utf-8") as f, open(args.out, "w", encoding="utf-8") as fs:
        fs.write(hdr)
        for line in f:
            if line.startswith("wav\t"):
                continue
            wav, script_no, secs, spk, text = line.rstrip("\n").split("\t", 4)
            try:
                no = int(script_no) - args.script_base
            except ValueError:
                unknown += 1
                continue
            if no not in scripts:
                unknown += 1
                continue
            dom, sub, intent, sent = scripts[no]
            if norm(sent) == norm(text):
                match += 1
            else:
                mismatch += 1
            secs_f = float(secs)
            row = f"{wav}\t{script_no}\t{secs}\t{spk}\t{dom}\t{sub}\t{intent}\t{text}\n"
            if fa:
                fa.write(row)
            if selected(dom, sub, intent, text):
                fs.write(row)
                n_sel += 1
                hours[dom] += secs_f / 3600
                files[dom] += 1
                speakers[dom].add(spk)
                sel_hours[f"{dom} > {sub} > {intent}"] += secs_f / 3600
    if fa:
        fa.close()

    print(f"text match: {match}, mismatch: {mismatch}, unknown script no: {unknown}")
    if unknown and unknown > match:
        print("!! 대부분의 대본 번호가 안 맞습니다. --script-base 값을 확인하세요.")
    print("selected by domain | files | hours | speakers")
    for d in sorted(hours, key=lambda k: -hours[k]):
        print(f"  {d} | {files[d]} | {hours[d]:.1f} | {len(speakers[d])}")
    print("selected by domain > subdomain > intent (hours)")
    for k, h in sorted(sel_hours.items(), key=lambda kv: -kv[1])[:40]:
        print(f"  {k}: {h:.1f} h")
    print("wrote", args.out, n_sel, "rows")


if __name__ == "__main__":
    main()
