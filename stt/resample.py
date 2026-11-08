"""48 kHz WAV → 16 kHz mono 16-bit WAV (Whisper 입력 규격). 멀티프로세스.

usage:
  python resample.py --src ~/data/aihub94/subway_wav/training --dst ~/data/aihub94/subway_16k/training
옵션: --workers 8  --limit N (테스트용)
이미 변환된 파일(같은 이름, 0바이트 아님)은 건너뛴다.
"""
import argparse
import os
import sys
import time
from multiprocessing import Pool

TARGET_SR = 16000


def _convert(job):
    src, dst = job
    try:
        if os.path.exists(dst) and os.path.getsize(dst) > 44:
            return "skip"
        import numpy as np
        import soundfile as sf
        import torch
        import torchaudio.functional as F

        data, sr = sf.read(src, dtype="float32", always_2d=True)
        data = data.mean(axis=1)  # mono
        if sr != TARGET_SR:
            data = F.resample(torch.from_numpy(data), sr, TARGET_SR).numpy()
        peak = float(np.abs(data).max()) if data.size else 0.0
        if peak > 1.0:
            data = data / peak
        sf.write(dst, data, TARGET_SR, subtype="PCM_16")
        return "ok"
    except Exception as e:  # noqa: BLE001
        return f"error: {src}: {e}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--dst", required=True)
    ap.add_argument("--workers", type=int, default=max(2, os.cpu_count() // 2))
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    src_dir = os.path.expanduser(args.src)
    dst_dir = os.path.expanduser(args.dst)
    os.makedirs(dst_dir, exist_ok=True)
    names = sorted(n for n in os.listdir(src_dir) if n.lower().endswith(".wav"))
    if args.limit:
        names = names[: args.limit]
    jobs = [(os.path.join(src_dir, n), os.path.join(dst_dir, n)) for n in names]
    print(f"{len(jobs)} files, {args.workers} workers: {src_dir} -> {dst_dir}", flush=True)

    t0 = time.time()
    counts = {"ok": 0, "skip": 0, "error": 0}
    errors = []
    with Pool(args.workers) as pool:
        for i, r in enumerate(pool.imap_unordered(_convert, jobs, chunksize=64), 1):
            if r.startswith("error"):
                counts["error"] += 1
                errors.append(r)
            else:
                counts[r] += 1
            if i % 5000 == 0:
                print(f"  {i}/{len(jobs)}  {time.time()-t0:.0f}s", flush=True)
    print(f"done in {time.time()-t0:.0f}s: {counts}")
    for e in errors[:10]:
        print(e)
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
