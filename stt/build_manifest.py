"""지하철 발화 매니페스트 생성 + 화자 단위 train/dev/test 분할.

입력: subway_list.py 가 만든 TSV(wav, script_no, seconds, speaker, domain, subdomain, intent, text)와
      16 kHz wav 폴더. TSV에 있어도 wav 파일이 없으면(아직 안 받은 zip) 제외한다.
분할: 화자 ID를 md5 해시 → 0~9 버킷. 0~7 train, 8 dev, 9 test (8:1:1).
      결정적(deterministic)이라 나중에 zip 2~6을 추가해도 같은 화자는 같은 분할에 남는다.
      AI-Hub의 training/validation 구분은 화자가 겹치므로(25명) 쓰지 않고 'aihub_split' 필드로만 기록.

usage:
  python build_manifest.py --config config.yaml
출력: <manifest_dir>/train.jsonl, dev.jsonl, test.jsonl, stats.json
"""
import argparse
import collections
import hashlib
import json
import os
import sys

import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from text_norm import normalize_for_training  # noqa: E402


def speaker_bucket(speaker: str, salt: str = "senior-voice") -> int:
    h = hashlib.md5(f"{salt}:{speaker}".encode("utf-8")).hexdigest()
    return int(h, 16) % 10


def split_of(bucket: int, dev_buckets, test_buckets) -> str:
    if bucket in test_buckets:
        return "test"
    if bucket in dev_buckets:
        return "dev"
    return "train"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(os.path.dirname(__file__), "config.yaml"))
    args = ap.parse_args()
    with open(args.config, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    data_root = os.path.expanduser(cfg["data"]["root"])
    manifest_dir = os.path.expanduser(cfg["data"]["manifest_dir"])
    os.makedirs(manifest_dir, exist_ok=True)
    max_sec = float(cfg["data"].get("max_seconds", 30))
    min_sec = float(cfg["data"].get("min_seconds", 0.3))
    dev_b = set(cfg["data"]["split"]["dev_buckets"])
    test_b = set(cfg["data"]["split"]["test_buckets"])

    try:
        import soundfile as sf
    except ImportError:
        sf = None

    rows = []
    missing = collections.Counter()
    dropped = collections.Counter()
    for src in cfg["data"]["sources"]:
        tsv = os.path.join(data_root, src["index_tsv"])
        wav_dir = os.path.join(data_root, src["wav16k_dir"])
        n_src = 0
        with open(tsv, encoding="utf-8") as f:
            header = f.readline().rstrip("\n").split("\t")
            col = {k: i for i, k in enumerate(header)}
            for line in f:
                c = line.rstrip("\n").split("\t")
                wav = c[col["wav"]]
                path = os.path.join(wav_dir, wav)
                if not os.path.exists(path):
                    missing[src["name"]] += 1
                    continue
                text_raw = c[col["text"]]
                text = normalize_for_training(text_raw)
                if not text:
                    dropped["empty_text"] += 1
                    continue
                if sf is not None:
                    info = sf.info(path)
                    dur = info.frames / info.samplerate
                else:
                    dur = float(c[col["seconds"]])
                if dur > max_sec or dur < min_sec:
                    dropped["duration"] += 1
                    continue
                spk = c[col["speaker"]]
                b = speaker_bucket(spk)
                rows.append({
                    "audio": path,
                    "text": text,
                    "text_raw": text_raw,
                    "speaker": spk,
                    "duration": round(dur, 3),
                    "domain": c[col["domain"]],
                    "subdomain": c[col["subdomain"]],
                    "intent": c[col["intent"]],
                    "script_no": c[col["script_no"]],
                    "aihub_split": src["name"],
                    "split": split_of(b, dev_b, test_b),
                })
                n_src += 1
        print(f"{src['name']}: {n_src} rows, {missing[src['name']]} listed but wav missing")

    # 같은 wav 이름이 두 소스에 있을 일은 없지만 안전하게 중복 제거
    seen = set()
    uniq = []
    for r in rows:
        k = os.path.basename(r["audio"])
        if k in seen:
            dropped["duplicate"] += 1
            continue
        seen.add(k)
        uniq.append(r)
    rows = uniq

    stats = {"dropped": dict(dropped), "missing_wav": dict(missing), "splits": {}}
    for split in ("train", "dev", "test"):
        part = [r for r in rows if r["split"] == split]
        out = os.path.join(manifest_dir, f"{split}.jsonl")
        with open(out, "w", encoding="utf-8") as f:
            for r in part:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        hours = sum(r["duration"] for r in part) / 3600
        spk = {r["speaker"] for r in part}
        sub = collections.Counter(r["subdomain"] for r in part)
        aih = collections.Counter(r["aihub_split"] for r in part)
        stats["splits"][split] = {
            "files": len(part), "hours": round(hours, 2), "speakers": len(spk),
            "subdomain": dict(sub), "aihub_split": dict(aih), "path": out,
        }
        print(f"{split:5s} | files {len(part):6d} | {hours:5.1f} h | speakers {len(spk):3d} | {dict(aih)}")

    # 화자 겹침 검사 (반드시 0이어야 함)
    spk_sets = {s: {r["speaker"] for r in rows if r["split"] == s} for s in ("train", "dev", "test")}
    overlap = {
        "train∩dev": len(spk_sets["train"] & spk_sets["dev"]),
        "train∩test": len(spk_sets["train"] & spk_sets["test"]),
        "dev∩test": len(spk_sets["dev"] & spk_sets["test"]),
    }
    stats["speaker_overlap"] = overlap
    print("speaker overlap:", overlap)
    with open(os.path.join(manifest_dir, "stats.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print("wrote", os.path.join(manifest_dir, "stats.json"))


if __name__ == "__main__":
    main()
