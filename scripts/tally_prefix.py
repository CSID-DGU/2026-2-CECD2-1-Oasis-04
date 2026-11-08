"""Tally an AI-Hub label zip by script-number prefix (from the file name) with duration sums.

usage: python3 -I tally_prefix.py <label zip> <out_index.tsv>
Writes one line per JSON: filename<TAB>script_no<TAB>seconds<TAB>speaker<TAB>text
"""
import sys
import json
import zipfile
import collections

path, out = sys.argv[1], sys.argv[2]
zf = zipfile.ZipFile(path)
by_prefix = collections.Counter()
secs_by_prefix = collections.defaultdict(float)
scripts_by_prefix = collections.defaultdict(set)
speakers_by_prefix = collections.defaultdict(set)
samples = collections.defaultdict(list)
bad = 0
n = 0
with open(out, "w", encoding="utf-8") as f:
    for i in zf.infolist():
        if not i.filename.lower().endswith(".json"):
            continue
        try:
            obj = json.loads(zf.read(i).decode("utf-8-sig"))
        except Exception:
            bad += 1
            continue
        base = i.filename.rsplit("/", 1)[-1].rsplit(".", 1)[0]
        parts = base.split("-")
        script_no = parts[1] if len(parts) > 1 else "?"
        prefix = script_no[:2]
        try:
            secs = float(obj["파일정보"]["FileLength"])
        except Exception:
            secs = 0.0
        spk = obj.get("화자정보", {}).get("SpeakerName", "?")
        text = obj.get("전사정보", {}).get("LabelText", "")
        wav = obj.get("파일정보", {}).get("FileName", base + ".wav")
        f.write(f"{wav}\t{script_no}\t{secs}\t{spk}\t{text}\n")
        by_prefix[prefix] += 1
        secs_by_prefix[prefix] += secs
        scripts_by_prefix[prefix].add(script_no)
        speakers_by_prefix[prefix].add(spk)
        if len(samples[prefix]) < 4:
            samples[prefix].append(text)
        n += 1
print(f"== {path}\njson: {n}, bad: {bad}")
print("prefix | files | hours | #scripts | script range | #speakers")
for p in sorted(by_prefix):
    sc = sorted(scripts_by_prefix[p])
    print(f"{p} | {by_prefix[p]:7d} | {secs_by_prefix[p]/3600:7.1f} | {len(sc):4d} | {sc[0]}..{sc[-1]} | {len(speakers_by_prefix[p])}")
    for t in samples[p]:
        print("     e.g.", t)
print("total hours:", round(sum(secs_by_prefix.values()) / 3600, 1))
