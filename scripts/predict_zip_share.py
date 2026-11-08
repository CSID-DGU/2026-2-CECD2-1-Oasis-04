"""Estimate how many selected files fall into each AI-Hub 원천 zip, assuming zips are filled in
sorted file-name order by bytes (observed for 키오스크 zip 1: 81,820 of 478,251 files = 17.1% vs 17.3% of bytes).

usage: python3 -I predict_zip_share.py <index_all.tsv> <selected.tsv> <zip sizes GB comma-separated>
"""
import sys

index_tsv, selected_tsv, sizes = sys.argv[1], sys.argv[2], [float(x) for x in sys.argv[3].split(",")]
rows = []
with open(index_tsv, encoding="utf-8") as f:
    for line in f:
        if line.startswith("wav\t"):
            continue
        c = line.rstrip("\n").split("\t")
        rows.append((c[0], float(c[2])))
rows.sort()
total = sum(s for _, s in rows)
sel = set()
with open(selected_tsv, encoding="utf-8") as f:
    for line in f:
        if line.startswith("wav\t"):
            continue
        sel.add(line.split("\t", 1)[0])
share = [s / sum(sizes) for s in sizes]
bounds = []
acc = 0.0
for sh in share:
    acc += sh
    bounds.append(acc * total)
zi = 0
cum = 0.0
per_zip_files = [0] * len(sizes)
per_zip_sel = [0] * len(sizes)
per_zip_sel_sec = [0.0] * len(sizes)
for name, secs in rows:
    while zi < len(bounds) - 1 and cum >= bounds[zi]:
        zi += 1
    cum += secs
    per_zip_files[zi] += 1
    if name in sel:
        per_zip_sel[zi] += 1
        per_zip_sel_sec[zi] += secs
print("zip | est. files | selected files | selected hours")
for i in range(len(sizes)):
    print(f"{i+1:3d} | {per_zip_files[i]:9d} | {per_zip_sel[i]:8d} | {per_zip_sel_sec[i]/3600:6.1f}")
print(f"total selected: {sum(per_zip_sel)} files, {sum(per_zip_sel_sec)/3600:.1f} h")
