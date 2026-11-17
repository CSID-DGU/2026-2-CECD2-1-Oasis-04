"""「소음 환경 음성인식 데이터」(AI-Hub 568)에서 역·터미널·지하철 소음 속 대화를 한 사람의 말 단위로 잘라 매니페스트를 만든다.

녹음 하나가 두 사람의 긴 대화이고, 라벨에는 말마다 시작·끝 시각이 1초 단위로 적혀 있다.
  - 경계가 거칠어서, 적힌 시각 앞뒤 0.8초 안에서 가장 조용한 지점으로 옮겨 자른다 (--no-snap 으로 끌 수 있다).
  - 정답 표기는 기존 교통 발화와 맞춘다: '(1 박)/(일 박)' 은 읽는 쪽('일 박')을 쓰고, 숫자·영문·주석 기호가 남는 말은 뺀다.
  - 분할은 말한 사람 단위(시험용·검증용 화자를 먼저 떼고 나머지가 학습용). 50대 화자를 먼저 뽑는다 (이 데이터에는 60대 이상이 없다).
  - 학습용은 같은 화자 안에서 소음이 큰 녹음부터 뽑는다. 2~20초인 말만 쓴다.

--src 폴더에는 aihubshell 로 받은 라벨(TL.zip)과 음성 묶음(TS*.zip)이 있어야 한다. 음성 묶음 이름의 마지막 부분이 소음 장소가 된다.
  예) TS2_07.터미널_01.기차역대합실.zip, TS2_07.터미널_02.버스터미널대합실.zip, TS2_06.지하철,버스_02.지하철안.zip

usage:  python build_noise_manifest.py --src ~/data/aihub_extra/noise568 --out ~/data/aihub_noise16k
출력: <out>/wav/noise/…wav (16 kHz mono), <out>/manifests/{train,dev,test}_noise.jsonl, stats_noise.json

학습에 넣기 전에 한 번 더 거른다: 잘라 낸 학습·검증용 음성을 그때 쓰던 모델로 받아써서(eval_baseline.py --split <jsonl>)
정답과 글자 오류율이 0.5 를 넘는 것은 뺀다 (잘못 잘렸거나 두 사람이 겹쳐 말한 것). 시험용은 거르지 않는다.
"""
import argparse
import collections
import glob
import hashlib
import io
import json
import math
import os
import random
import re
import sys
import zipfile

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from text_norm import normalize_for_training  # noqa: E402

LEFTOVER = re.compile(r"[()\[\]{}/*&@#<>+=_~^|\]|[A-Za-z0-9]")
DUAL = re.compile(r"\(([^()]*)\)\s*/\s*\(([^()]*)\)")      # (적는 표기)/(읽는 표기)


def fixed(name: str) -> str:
    try:
        return name.encode("cp437").decode("cp949")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name


def stem(name: str) -> str:
    return os.path.splitext(os.path.basename(name))[0]


def to_float(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def clean(text: str) -> str:
    t = DUAL.sub(lambda m: m.group(2), text).replace("~", "")
    t = normalize_for_training(t)
    return "" if (not t or LEFTOVER.search(t)) else t


def self_check():
    """표기 규칙이 의도대로 도는지 실행할 때 한 번 확인한다."""
    assert clean("지금(1 박)/(일 박) (2 일)/(이 일) 보고 있었어요.").replace(" ", "") == "지금일박이일보고있었어요."
    assert clean("어~ 너무 귀여워요") and clean("3번 출구") == "" and clean("TV 봐요") == ""


def snap(x, sr, t):
    """경계 t(초) 앞뒤 0.8초에서 0.2초 창의 소리 크기가 가장 작은 곳의 가운데를 돌려준다."""
    a, b = max(0, int((t - 0.8) * sr)), min(len(x), int((t + 0.8) * sr))
    win, hop = int(0.2 * sr), int(0.02 * sr)
    if b - a <= win + hop:
        return min(max(t, 0.0), len(x) / sr)
    c = np.concatenate([[0.0], np.cumsum(x[a:b].astype(np.float64) ** 2)])
    starts = np.arange(0, (b - a) - win, hop)
    k = int(starts[np.argmin(c[starts + win] - c[starts])])
    return (a + k + win / 2) / sr


def assign_splits(rows, want_hours):
    """화자를 test → dev 순으로 목표 시간만큼 떼어 놓고 나머지는 train. 화자가 적어도 시험용이 비지 않게 한다.
    순서는 화자 이름의 해시라 실행할 때마다 같다. 혼자 분량이 너무 큰 화자는 되도록 학습 쪽에 남긴다."""
    hours = collections.Counter()
    for r in rows:
        hours[r["speaker"]] += r["duration"] / 3600
    order = sorted(hours, key=lambda s: hashlib.md5(s.encode("utf-8")).hexdigest())
    split, got = {}, {"test": 0.0, "dev": 0.0}
    if len(order) >= 4:
        for name in ("test", "dev"):
            for strict in (True, False):
                for s in order:
                    if got[name] >= want_hours[name]:
                        break
                    if s in split or (strict and hours[s] > 3 * want_hours[name]):
                        continue
                    split[s] = name
                    got[name] += hours[s]
    return {s: split.get(s, "train") for s in order}


def pick(rows, hours, rng, loud_first=False):
    """우선 대상(prefer)을 먼저, 화자를 돌아가며 시간 상한까지 뽑는다. loud_first 면 화자 안에서 소음이 큰 녹음부터 뽑는다."""
    by_spk = collections.defaultdict(list)
    for r in rows:
        by_spk[r["speaker"]].append(r)
    for v in by_spk.values():
        rng.shuffle(v)
        if loud_first:
            v.sort(key=lambda r: r["noise"])           # pop() 이 뒤에서 꺼내므로 소음이 큰 것이 먼저 나온다
    speakers = sorted(by_spk)
    rng.shuffle(speakers)
    speakers.sort(key=lambda s: not by_spk[s][0]["prefer"])
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
    ap.add_argument("--src", default="~/data/aihub_extra/noise568")
    ap.add_argument("--out", default="~/data/aihub_noise16k")
    ap.add_argument("--train-hours", type=float, default=3.0, help="소음 장소마다 학습에 넣을 시간 상한")
    ap.add_argument("--dev-hours", type=float, default=0.15)
    ap.add_argument("--test-hours", type=float, default=0.4)
    ap.add_argument("--min-seconds", type=float, default=2.0)
    ap.add_argument("--max-seconds", type=float, default=20.0)
    ap.add_argument("--no-snap", action="store_true")
    ap.add_argument("--limit-files", type=int, default=0, help="시험용: 장소마다 녹음 파일을 이만큼만 쓴다")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    self_check()
    src, out = os.path.expanduser(args.src), os.path.expanduser(args.out)
    caps = {"train": args.train_hours, "dev": args.dev_hours, "test": args.test_hours}
    rng = random.Random(args.seed)
    wav_dir = os.path.join(out, "wav", "noise")
    os.makedirs(wav_dir, exist_ok=True)
    os.makedirs(os.path.join(out, "manifests"), exist_ok=True)

    label_zip = zipfile.ZipFile(glob.glob(os.path.join(src, "**", "TL.zip"), recursive=True)[0])
    labels = {stem(fixed(i.filename)): i for i in label_zip.infolist() if i.filename.endswith(".json")}
    result = {"train": [], "dev": [], "test": []}
    stats = {}

    # 1단계: 라벨만 읽어 쓸 수 있는 말을 모은다 (장소별)
    places = []
    for zp in sorted(glob.glob(os.path.join(src, "**", "TS*.zip"), recursive=True)):
        place = os.path.splitext(os.path.basename(zp))[0].split(".")[-1]          # TS2_07.터미널_01.기차역대합실 → 기차역대합실
        az = zipfile.ZipFile(zp)
        wavs = {stem(fixed(n)): n for n in az.namelist() if n.lower().endswith(".wav")}
        keys = sorted(k for k in wavs if k in labels)
        if args.limit_files:
            keys = keys[: args.limit_files]
        dropped = collections.Counter()
        usable = []
        places.append((place, az, wavs, keys, dropped, usable))
        for key in keys:
            d = json.loads(label_zip.read(labels[key]).decode("utf-8-sig", errors="replace"))
            who = {s.get("speaker"): s for s in d.get("speakers") or []}
            info = (d.get("typeInfo") or [{}])[0]
            for n, t in enumerate(d.get("dialogs") or []):
                try:
                    start, end = float(t["startTime"]), float(t["endTime"])
                except (KeyError, TypeError, ValueError):
                    dropped["time"] += 1
                    continue
                text = clean(t.get("speakerText") or "")
                if not text:
                    dropped["text(빈 말·숫자·영문·주석 기호)"] += 1
                elif not (args.min_seconds <= end - start <= args.max_seconds):
                    dropped["duration"] += 1
                else:
                    s = who.get(t.get("speaker")) or {}
                    spk = f"nz_{t.get('speaker')}_{s.get('gender', '')}_{s.get('ageGroup', '')}"
                    usable.append({"key": f"{key}_{n:03d}", "file": key, "start": start, "end": end, "duration": end - start,
                                   "text": text, "text_raw": t.get("speakerText") or "", "speaker": spk,
                                   "age_group": str(s.get("ageGroup", "")), "prefer": str(s.get("ageGroup", "")) >= "50",
                                   "env": f"{info.get('place', '')} {info.get('avgnoisespl', '')}dB", "intent": d.get("conversationType", ""),
                                   "noise": to_float(info.get("avgnoisespl"))})

    # 2단계: 화자 단위로 나눈다. 같은 사람이 여러 장소에 나와도 한쪽에만 들어가게 전체를 한 번에 정한다.
    n_places = max(1, len(places))
    split_of_speaker = assign_splits([r for p in places for r in p[5]],
                                     {"test": args.test_hours * n_places, "dev": args.dev_hours * n_places})
    print("speakers:", collections.Counter(split_of_speaker.values()), flush=True)

    # 3단계: 장소마다 시간 상한까지 뽑아 음성을 잘라 낸다
    for place, az, wavs, keys, dropped, usable in places:
        for r in usable:
            r["split"] = split_of_speaker[r["speaker"]]
        stats[place] = {"recordings": len(keys), "available": {
            "turns": len(usable), "hours": round(sum(r["duration"] for r in usable) / 3600, 1), "speakers": len({r["speaker"] for r in usable})}}
        chosen = []
        for split in ("train", "dev", "test"):
            chosen += pick([r for r in usable if r["split"] == split], caps[split], rng, loud_first=(split == "train"))
        by_file = collections.defaultdict(list)
        for r in chosen:
            by_file[r["file"]].append(r)
        kept = {"train": [], "dev": [], "test": []}
        for n, (key, rows) in enumerate(sorted(by_file.items())):
            data, sr = sf.read(io.BytesIO(az.read(wavs[key])), dtype="float32", always_2d=True)
            x = data.mean(axis=1)
            g = math.gcd(sr, 16000)
            cuts = {}
            for r in rows:
                for t in (r["start"], r["end"]):
                    if t not in cuts:
                        cuts[t] = t if args.no_snap else snap(x, sr, t)
                a, b = cuts[r["start"]], min(cuts[r["end"]], len(x) / sr)
                if b - a < 1.0:
                    dropped["too_short_after_cut"] += 1
                    continue
                y = x[int(a * sr): int(b * sr)]
                if sr != 16000:
                    y = resample_poly(y, 16000 // g, sr // g)
                path = os.path.join(wav_dir, r["key"] + ".wav")
                sf.write(path, np.clip(y, -1.0, 1.0), 16000, subtype="PCM_16")
                kept[r["split"]].append({"audio": path, "text": r["text"], "text_raw": r["text_raw"], "speaker": r["speaker"],
                                         "duration": round(len(y) / 16000, 2), "domain": "보조", "subdomain": f"소음대화({place})",
                                         "intent": r["intent"], "script_no": r["file"], "aihub_split": "noise_training", "split": r["split"],
                                         "age_group": r["age_group"], "env": r["env"]})
            if (n + 1) % 100 == 0:
                print(f"  {place} {n + 1}/{len(by_file)} recordings", flush=True)
        for split in kept:
            result[split].extend(kept[split])
            stats[place][split] = {"files": len(kept[split]), "hours": round(sum(r["duration"] for r in kept[split]) / 3600, 2),
                                   "speakers": len({r["speaker"] for r in kept[split]})}
        stats[place]["dropped"] = dict(dropped)
        stats[place]["sample_rate"] = sr if by_file else None
        print(place, json.dumps(stats[place], ensure_ascii=False), flush=True)

    for split, rows in result.items():
        path = os.path.join(out, "manifests", f"{split}_noise.jsonl")
        with open(path, "w", encoding="utf-8") as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"{split:5s} | files {len(rows):6d} | {sum(r['duration'] for r in rows) / 3600:5.1f} h | "
              f"speakers {len({r['speaker'] for r in rows}):4d} | {path}")
    with open(os.path.join(out, "manifests", "stats_noise.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
