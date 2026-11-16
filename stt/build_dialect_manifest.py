"""AI-Hub 「중·노년층 한국어 방언 데이터」(71517 강원·경상, 71558 충청·전라·제주)의 '1인발화 따라말하기' 를
학습·평가용 매니페스트로 만든다.

라벨 zip(JSON)과 원천 zip(16 kHz wav)을 직접 읽어, 고른 발화만 wav 로 풀어 낸다 (zip 전체를 풀지 않는다).
분할은 교통 발화와 같은 화자 해시(0~7 train, 8 dev, 9 test)이고, 지역마다 시간 상한을 두어 고르게 뽑는다.
정답 문장은 방언 표기(transcription.dialect)를 쓴다. 실제로 말한 그대로이고, 표준어 치환문(standard)은
단어 단위로 바꿔 넣은 것이라 중복·공백 오류가 섞여 있다. 치환문은 text_standard 에 참고용으로 남긴다.

usage:
  python build_dialect_manifest.py --src ~/data/aihub_dialect --out ~/data/aihub_dialect16k \
      --train-hours 5 --dev-hours 0.4 --test-hours 0.6
출력: <out>/wav/<지역>/<파일>.wav, <out>/manifests/{train,dev,test}_dialect.jsonl, <out>/manifests/stats_dialect.json
"""
import argparse
import collections
import glob
import io
import json
import os
import random
import re
import sys
import zipfile

import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_manifest import speaker_bucket, split_of  # noqa: E402
from text_norm import normalize_for_training  # noqa: E402

REGION_RE = re.compile(r"(강원도|경상도|충청도|전라도|제주도)")
BAD_CHARS = re.compile(r"[()\[\]{}/*&@#<>]")


def stem(name: str) -> str:
    return os.path.splitext(os.path.basename(name))[0]


def read_labels(label_zip: str, region: str, min_sec: float, max_sec: float, dropped: collections.Counter):
    rows = []
    zf = zipfile.ZipFile(label_zip)
    for info in zf.infolist():
        if not info.filename.endswith(".json"):
            continue
        d = json.loads(zf.read(info).decode("utf-8-sig"))
        t = d.get("transcription") or {}
        text_raw = (t.get("dialect") or "").strip()
        dur = float((d.get("audio") or {}).get("recordDuration") or 0)
        speakers = d.get("speaker") or []
        if isinstance(speakers, dict):
            speakers = [speakers]
        if len(speakers) != 1:
            dropped["speaker_count"] += 1
            continue
        if (d.get("annotation") or {}).get("transcriptionAnnotations"):
            dropped["annotated"] += 1     # 간투사·반복·청취불가 등 주석이 붙은 발화는 뺀다
            continue
        if not text_raw or BAD_CHARS.search(text_raw):
            dropped["empty_or_markup"] += 1
            continue
        if not (min_sec <= dur <= max_sec):
            dropped["duration"] += 1
            continue
        text = normalize_for_training(text_raw)
        if not text:
            dropped["empty_after_norm"] += 1
            continue
        s = speakers[0]
        script = d.get("script") or {}
        rows.append({
            "key": stem(info.filename), "text": text, "text_raw": text_raw,
            "text_standard": (t.get("standard") or "").strip(),
            "speaker": str(s.get("speakerId")), "duration": dur, "domain": "방언", "subdomain": region,
            "intent": str(script.get("domain") or ""), "script_no": str(int(script.get("scriptId") or 0)),
            "gender": s.get("gender"), "birth_year": int(s.get("birthYear") or 0), "aihub_split": "dialect_validation",
        })
    return rows


def pick(rows, hours: float, rng: random.Random):
    """화자를 돌아가며 한 문장씩 뽑아 시간 상한까지 채운다 (특정 화자에 쏠리지 않게)."""
    by_spk = collections.defaultdict(list)
    for r in rows:
        by_spk[r["speaker"]].append(r)
    speakers = sorted(by_spk)
    rng.shuffle(speakers)
    for s in speakers:
        rng.shuffle(by_spk[s])
    out, total, limit = [], 0.0, hours * 3600
    while speakers and total < limit:
        for s in list(speakers):
            if not by_spk[s]:
                speakers.remove(s)
                continue
            r = by_spk[s].pop()
            out.append(r)
            total += r["duration"]
            if total >= limit:
                break
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="~/data/aihub_dialect", help="aihubshell 로 받은 폴더 (라벨·원천 zip 이 들어 있는 곳)")
    ap.add_argument("--out", default="~/data/aihub_dialect16k")
    ap.add_argument("--train-hours", type=float, default=5.0, help="지역마다 학습에 넣을 시간 상한")
    ap.add_argument("--dev-hours", type=float, default=0.4)
    ap.add_argument("--test-hours", type=float, default=0.6)
    ap.add_argument("--min-seconds", type=float, default=1.0)
    ap.add_argument("--max-seconds", type=float, default=20.0)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    src, out = os.path.expanduser(args.src), os.path.expanduser(args.out)
    caps = {"train": args.train_hours, "dev": args.dev_hours, "test": args.test_hours}
    rng = random.Random(args.seed)

    label_zips = sorted(glob.glob(os.path.join(src, "**", "*VL_*따라말하기*.zip"), recursive=True))
    audio_zips = {REGION_RE.search(os.path.basename(z)).group(1): z
                  for z in glob.glob(os.path.join(src, "**", "*VS_*따라말하기*.zip"), recursive=True)}
    os.makedirs(os.path.join(out, "manifests"), exist_ok=True)
    result = {"train": [], "dev": [], "test": []}
    stats = {"regions": {}, "dropped": {}}
    for lz in label_zips:
        region = REGION_RE.search(os.path.basename(lz)).group(1)
        if region not in audio_zips:
            print(f"{region}: 원천 zip 이 없어 건너뜀")
            continue
        dropped = collections.Counter()
        rows = read_labels(lz, region, args.min_seconds, args.max_seconds, dropped)
        az = zipfile.ZipFile(audio_zips[region])
        wav_names = {stem(n): n for n in az.namelist() if n.lower().endswith(".wav")}
        rows = [r for r in rows if r["key"] in wav_names]
        for r in rows:
            r["split"] = split_of(speaker_bucket(r["speaker"]), {8}, {9})
        wav_dir = os.path.join(out, "wav", region)
        os.makedirs(wav_dir, exist_ok=True)
        stats["regions"][region] = {"available": {"files": len(rows), "hours": round(sum(r["duration"] for r in rows) / 3600, 1),
                                                  "speakers": len({r["speaker"] for r in rows})}}
        for split in ("train", "dev", "test"):
            chosen = pick([r for r in rows if r["split"] == split], caps[split], rng)
            kept = []
            for r in chosen:
                data = az.read(wav_names[r["key"]])
                info = sf.info(io.BytesIO(data))
                if info.samplerate != 16000:
                    dropped["not_16k"] += 1
                    continue
                path = os.path.join(wav_dir, r["key"] + ".wav")
                with open(path, "wb") as f:
                    f.write(data)
                row = {"audio": path, **{k: v for k, v in r.items() if k != "key"}}
                row["duration"] = round(info.frames / info.samplerate, 2)
                kept.append(row)
            result[split].extend(kept)
            stats["regions"][region][split] = {"files": len(kept), "hours": round(sum(r["duration"] for r in kept) / 3600, 2),
                                               "speakers": len({r["speaker"] for r in kept})}
        stats["dropped"][region] = dict(dropped)
        print(region, json.dumps(stats["regions"][region], ensure_ascii=False), "| dropped", dict(dropped), flush=True)

    for split, rows in result.items():
        path = os.path.join(out, "manifests", f"{split}_dialect.jsonl")
        with open(path, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"{split:5s} | files {len(rows):6d} | {sum(r['duration'] for r in rows) / 3600:5.1f} h | "
              f"speakers {len({r['speaker'] for r in rows}):3d} | {path}")
    spk = {s: {r["speaker"] for r in rows} for s, rows in result.items()}
    overlap = len(spk["train"] & spk["dev"]) + len(spk["train"] & spk["test"]) + len(spk["dev"] & spk["test"])
    print("speaker overlap between splits:", overlap)
    stats["speaker_overlap"] = overlap
    with open(os.path.join(out, "manifests", "stats_dialect.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
