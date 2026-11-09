"""병합이 끝난 AI-Hub zip(aihubshell 이 만든 것)에서 목록에 있는 파일만 꺼낸다.

usage: python extract_from_zip.py <archive.zip> <wanted.tsv> <out_dir> [--list-only]
  wanted.tsv: 첫 열 = wav 파일 이름 (헤더 허용). select_utterances.py 출력 그대로 쓰면 된다.
zip 안의 한글 이름은 cp437 로 잘못 읽힐 수 있어 cp949 로 되돌린다. 이미 있는 파일(크기 같음)은 건너뛴다.
tar 안에 분할된 zip 은 extract_from_tar.py 를 쓴다.
"""
import os
import sys
import time
import zipfile

zip_path, wanted_tsv, out_dir = sys.argv[1:4]
list_only = "--list-only" in sys.argv


def fix(name: str) -> str:
    try:
        return name.encode("cp437").decode("cp949")
    except Exception:
        return name


t0 = time.time()
zf = zipfile.ZipFile(os.path.expanduser(zip_path))
by_base = {}
for i in zf.infolist():
    n = i.filename if (i.flag_bits & 0x800) else fix(i.filename)
    by_base[n.rsplit("/", 1)[-1]] = i
print(f"zip entries: {len(by_base)}, opened in {time.time()-t0:.1f}s")

wanted = []
with open(os.path.expanduser(wanted_tsv), encoding="utf-8") as f:
    for line in f:
        w = line.split("\t", 1)[0].strip()
        if w and w != "wav":
            wanted.append(w)
hit = [w for w in wanted if w in by_base]
print(f"wanted: {len(wanted)}, found in this archive: {len(hit)} ({sum(by_base[w].file_size for w in hit)/2**30:.2f} GiB)")
if list_only:
    sys.exit(0)

os.makedirs(os.path.expanduser(out_dir), exist_ok=True)
done = skipped = 0
t1 = time.time()
for k, w in enumerate(hit, 1):
    dst = os.path.join(os.path.expanduser(out_dir), w)
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
    if k % 5000 == 0:
        print(f"  {k}/{len(hit)}  {time.time()-t1:.0f}s", flush=True)
print(f"extracted: {done}, skipped(existing): {skipped}, {time.time()-t1:.0f}s -> {out_dir}")
