"""Extract selected files from an AI-Hub split zip (zip.part0, zip.part1073741824, ...) that is
still packed inside a .tar, without extracting or merging anything first.

The tar members are read in place: a virtual seekable file is built over the concatenated
.part* regions of the tar, and Python's zipfile reads the zip through it.

usage: python3 -I extract_from_tar.py <archive.tar> <wanted.tsv> <out_dir> [--list-only]
  wanted.tsv: first column = wav file name (header line allowed)
"""
import io
import os
import re
import sys
import time
import zipfile
import tarfile

tar_path, wanted_tsv, out_dir = sys.argv[1:4]
list_only = "--list-only" in sys.argv


def fix(name: str) -> str:
    try:
        return name.encode("cp437").decode("cp949")
    except Exception:
        return name


class SplitView(io.RawIOBase):
    """Seekable read-only view over several (offset, size) regions of one file, concatenated."""

    def __init__(self, path, regions):
        self.f = open(path, "rb", buffering=0)
        self.regions = regions  # list of (start_in_file, size)
        self.starts = []
        total = 0
        for _, size in regions:
            self.starts.append(total)
            total += size
        self.total = total
        self.pos = 0

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, off, whence=io.SEEK_SET):
        if whence == io.SEEK_SET:
            self.pos = off
        elif whence == io.SEEK_CUR:
            self.pos += off
        elif whence == io.SEEK_END:
            self.pos = self.total + off
        self.pos = max(0, min(self.pos, self.total))
        return self.pos

    def readinto(self, b):
        n = len(b)
        if self.pos >= self.total or n == 0:
            return 0
        # find region containing self.pos (regions are few, linear scan is fine)
        idx = 0
        for i, s in enumerate(self.starts):
            if s <= self.pos:
                idx = i
        start_file, size = self.regions[idx]
        delta = self.pos - self.starts[idx]
        chunk = min(n, size - delta)
        self.f.seek(start_file + delta)
        data = self.f.read(chunk)
        b[: len(data)] = data
        self.pos += len(data)
        return len(data)


t0 = time.time()
tf = tarfile.open(tar_path, "r:")
members = []
for m in tf.getmembers():
    if not m.isfile():
        continue
    mo = re.search(r"\.zip\.part(\d+)$", m.name)
    if mo:
        members.append((int(mo.group(1)), m.offset_data, m.size, m.name))
tf.close()
members.sort()
print(f"tar members (zip parts): {len(members)}, scanned in {time.time()-t0:.1f}s")
expected = 0
for part_off, _, size, _ in members:
    if part_off != expected:
        sys.exit(f"part offsets are not contiguous: expected {expected}, got {part_off}")
    expected += size
print(f"logical zip size: {expected/2**30:.2f} GiB")

view = SplitView(tar_path, [(off, size) for _, off, size, _ in members])
zf = zipfile.ZipFile(io.BufferedReader(view, buffer_size=4 * 2**20))
infos = zf.infolist()
print(f"zip entries: {len(infos)}, opened in {time.time()-t0:.1f}s")

# map base name -> ZipInfo
by_base = {}
for i in infos:
    n = i.filename if (i.flag_bits & 0x800) else fix(i.filename)
    by_base[n.rsplit("/", 1)[-1]] = i
print("sample entries:")
for n in list(by_base)[:3]:
    print("  ", n)

wanted = []
with open(wanted_tsv, encoding="utf-8") as f:
    for line in f:
        w = line.split("\t", 1)[0].strip()
        if w and w != "wav":
            wanted.append(w)
hit = [w for w in wanted if w in by_base]
print(f"wanted: {len(wanted)}, found in this archive: {len(hit)} "
      f"({sum(by_base[w].file_size for w in hit)/2**30:.2f} GiB)")

if list_only:
    sys.exit(0)

os.makedirs(out_dir, exist_ok=True)
done = skipped = 0
bytes_done = 0
t1 = time.time()
for k, w in enumerate(hit, 1):
    dst = os.path.join(out_dir, w)
    zi = by_base[w]
    if os.path.exists(dst) and os.path.getsize(dst) == zi.file_size:
        skipped += 1
        continue
    with zf.open(zi) as src, open(dst, "wb") as out:
        while True:
            buf = src.read(1 << 20)
            if not buf:
                break
            out.write(buf)
    done += 1
    bytes_done += zi.file_size
    if k % 5000 == 0:
        el = time.time() - t1
        print(f"  {k}/{len(hit)}  {bytes_done/2**30:.2f} GiB  {el:.0f}s", flush=True)
print(f"extracted: {done}, skipped(existing): {skipped}, {bytes_done/2**30:.2f} GiB, "
      f"{time.time()-t1:.0f}s -> {out_dir}")
