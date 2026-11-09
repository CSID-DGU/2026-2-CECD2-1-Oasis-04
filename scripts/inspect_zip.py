"""Inspect AI-Hub zip files (labels / script) without extracting everything.

usage: python3 -I inspect_zip.py <zip path> [max_json_to_scan]
"""
import sys
import json
import zipfile
import collections

path = sys.argv[1]
max_scan = int(sys.argv[2]) if len(sys.argv) > 2 else 20000


def fix(name: str) -> str:
    """zip names without the UTF-8 flag are decoded as cp437 by Python; re-decode as cp949."""
    try:
        return name.encode("cp437").decode("cp949")
    except Exception:
        return name


zf = zipfile.ZipFile(path)
infos = zf.infolist()
names = [(fix(i.filename) if not (i.flag_bits & 0x800) else i.filename, i) for i in infos]
print(f"== {path}")
print(f"entries: {len(names)}")
print("first 8 names:")
for n, _ in names[:8]:
    print("  ", n)

# extension tally
ext = collections.Counter(n.rsplit(".", 1)[-1].lower() if "." in n else "(dir)" for n, _ in names)
print("by extension:", dict(ext.most_common(10)))

# top-level directory tally
top = collections.Counter("/".join(n.split("/")[:3]) for n, _ in names)
print("top dirs (first 3 levels):")
for k, v in top.most_common(30):
    print(f"  {v:7d}  {k}")

# one sample of each non-json small text file (script zip)
shown_txt = 0
for n, i in names:
    low = n.lower()
    if low.endswith((".txt", ".csv", ".tsv")) and shown_txt < 2 and i.file_size < 2_000_000:
        data = zf.read(i)
        for enc in ("utf-8-sig", "cp949", "utf-16"):
            try:
                text = data.decode(enc)
                break
            except Exception:
                text = None
        print(f"--- sample text file: {n} ({i.file_size} bytes, enc guess ok={text is not None})")
        if text:
            lines = text.splitlines()
            print(f"    lines: {len(lines)}")
            for ln in lines[:25]:
                print("   |", ln[:160])
        shown_txt += 1

# JSON: show one full sample, then tally interesting fields
json_names = [(n, i) for n, i in names if n.lower().endswith(".json")]
print(f"json files: {len(json_names)}")
if json_names:
    n0, i0 = json_names[0]
    raw = zf.read(i0)
    try:
        txt = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        txt = raw.decode("cp949", errors="replace")
    print(f"--- first json: {n0}")
    print(txt[:3000])

    def flatten(obj, prefix=""):
        out = {}
        if isinstance(obj, dict):
            for k, v in obj.items():
                out.update(flatten(v, f"{prefix}{k}."))
        elif isinstance(obj, list):
            for idx, v in enumerate(obj[:3]):
                out.update(flatten(v, f"{prefix}{idx}."))
        else:
            out[prefix[:-1]] = obj
        return out

    tallies = collections.defaultdict(collections.Counter)
    code_tally = collections.Counter()
    scanned = 0
    for n, i in json_names[:max_scan]:
        try:
            obj = json.loads(zf.read(i).decode("utf-8-sig"))
        except Exception:
            continue
        flat = flatten(obj)
        for k, v in flat.items():
            if isinstance(v, (str, int, float)) and len(str(v)) <= 40:
                tallies[k][str(v)] += 1
        base = n.rsplit("/", 1)[-1].rsplit(".", 1)[0]
        parts = base.split("-")
        if len(parts) >= 3:
            code_tally[(parts[1], parts[2])] += 1
        scanned += 1
    print(f"scanned json: {scanned}")
    print("--- fields with few distinct values (candidate category fields):")
    for k, c in sorted(tallies.items()):
        if 1 < len(c) <= 60:
            print(f"  {k}: {len(c)} values -> {dict(c.most_common(15))}")
    print("--- filename code tally (데이터항목-카테고리):")
    for k, v in sorted(code_tally.items()):
        print(f"  {k}: {v}")
