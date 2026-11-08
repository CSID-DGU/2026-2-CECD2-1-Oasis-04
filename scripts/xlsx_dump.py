"""Dump an .xlsx stored inside an outer zip, using only the stdlib.

usage: python3 -I xlsx_dump.py <outer.zip> <member substring> <out.tsv> [max_print_rows]
"""
import io
import re
import sys
import zipfile
import collections
import xml.etree.ElementTree as ET

outer, member_sub, out_tsv = sys.argv[1], sys.argv[2], sys.argv[3]
max_print = int(sys.argv[4]) if len(sys.argv) > 4 else 25

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def fix(name):
    try:
        return name.encode("cp437").decode("cp949")
    except Exception:
        return name


oz = zipfile.ZipFile(outer)
target = None
for i in oz.infolist():
    n = i.filename if (i.flag_bits & 0x800) else fix(i.filename)
    if member_sub in n:
        target = i
        print("member:", n)
        break
if target is None:
    sys.exit("member not found")

xz = zipfile.ZipFile(io.BytesIO(oz.read(target)))
shared = []
if "xl/sharedStrings.xml" in xz.namelist():
    root = ET.fromstring(xz.read("xl/sharedStrings.xml"))
    for si in root.findall("m:si", NS):
        shared.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))

sheets = sorted(n for n in xz.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n))
print("sheets:", sheets)


def col_index(ref):
    letters = re.match(r"[A-Z]+", ref).group(0)
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - 64)
    return idx - 1


all_rows = []
for sh in sheets:
    root = ET.fromstring(xz.read(sh))
    rows = []
    for r in root.iter("{%s}row" % NS["m"]):
        cells = {}
        for c in r.findall("m:c", NS):
            ref = c.get("r")
            t = c.get("t")
            v = c.find("m:v", NS)
            is_ = c.find("m:is", NS)
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif t == "inlineStr" and is_ is not None:
                val = "".join(x.text or "" for x in is_.iter("{%s}t" % NS["m"]))
            elif v is not None:
                val = v.text
            else:
                val = ""
            cells[col_index(ref)] = val
        if cells:
            width = max(cells) + 1
            rows.append([cells.get(k, "") for k in range(width)])
    print(f"{sh}: {len(rows)} rows")
    all_rows.extend([sh] + row for row in rows)

with open(out_tsv, "w", encoding="utf-8") as f:
    for row in all_rows:
        f.write("\t".join(str(x).replace("\t", " ").replace("\n", " ") for x in row) + "\n")
print("wrote", out_tsv, len(all_rows), "rows")

print("--- first rows ---")
for row in all_rows[:max_print]:
    print(" | ".join(str(x)[:40] for x in row))

# per-column distinct tally for low-cardinality columns
width = max(len(r) for r in all_rows)
print("--- low-cardinality columns ---")
for ci in range(1, width):
    c = collections.Counter(str(r[ci]) for r in all_rows[1:] if ci < len(r) and str(r[ci]) != "")
    if 1 < len(c) <= 40:
        print(f"col {ci}: {len(c)} values -> {dict(c.most_common(40))}")
