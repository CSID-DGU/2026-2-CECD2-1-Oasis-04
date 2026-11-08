"""Whisper 평가: 기본 모델(E0) 또는 LoRA 어댑터를 매니페스트에 돌려 CER·문장 정확도·RTF를 잰다.

usage:
  python eval_baseline.py --config config.yaml --split test --model openai/whisper-large-v3-turbo
  python eval_baseline.py --config config.yaml --split test --model openai/whisper-large-v3-turbo \
      --adapter ~/senior-voice/runs/lora-v1/adapter --tag turbo-lora-v1
옵션: --max-samples N (점검용), --batch-size, --beam, --tag (출력 폴더 이름)

출력 (runs/eval/<tag>/):
  metrics.json      전체·세부 도메인별 CER(공백 제거/유지), 문장 정확도, RTF, 처리 시간
  predictions.tsv   wav, 정답, 인식 결과, 발화별 CER  (전사가 들어 있으므로 커밋하지 않는다)
"""
import argparse
import collections
import json
import os
import sys
import time

import jiwer
import soundfile as sf
import torch
import yaml

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from text_norm import normalize_for_cer  # noqa: E402


def load_manifest(path, max_samples=0):
    rows = []
    with open(os.path.expanduser(path), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    if max_samples:
        rows = rows[:max_samples]
    return rows


def read_audio(path):
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    if sr != 16000:
        raise ValueError(f"{path}: sampling rate {sr}, 16000 필요 (resample.py 먼저)")
    return data.mean(axis=1)


def corpus_cer(refs, hyps):
    pairs = [(r, h) for r, h in zip(refs, hyps) if r]
    if not pairs:
        return None
    return jiwer.cer([r for r, _ in pairs], [h if h else " " for _, h in pairs])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(os.path.dirname(__file__), "config.yaml"))
    ap.add_argument("--split", default="test", help="train / dev / test, 또는 jsonl 경로")
    ap.add_argument("--model", required=True, help="HF 모델 ID 또는 로컬 경로")
    ap.add_argument("--adapter", default="", help="PEFT LoRA 어댑터 폴더 (없으면 기본 모델 평가)")
    ap.add_argument("--tag", default="", help="출력 폴더 이름. 기본: 모델명[-adapter]")
    ap.add_argument("--max-samples", type=int, default=None)
    ap.add_argument("--batch-size", type=int, default=None)
    ap.add_argument("--beam", type=int, default=None)
    ap.add_argument("--out-root", default="", help="기본: train.output_dir 의 상위/eval")
    args = ap.parse_args()

    with open(args.config, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    ecfg = cfg.get("eval", {})
    batch_size = args.batch_size or int(ecfg.get("batch_size", 8))
    beam = args.beam or int(ecfg.get("beam_size", 1))
    max_samples = args.max_samples if args.max_samples is not None else int(ecfg.get("max_eval_samples", 0))
    language = cfg.get("models", {}).get("language", "ko")
    task = cfg.get("models", {}).get("task", "transcribe")

    manifest = args.split if args.split.endswith(".jsonl") else os.path.join(
        os.path.expanduser(cfg["data"]["manifest_dir"]), f"{args.split}.jsonl")
    rows = load_manifest(manifest, max_samples)
    if not rows:
        sys.exit(f"매니페스트가 비어 있습니다: {manifest}")

    tag = args.tag or (args.model.rstrip("/").split("/")[-1] + ("-" + os.path.basename(args.adapter.rstrip("/")) if args.adapter else ""))
    out_root = os.path.expanduser(args.out_root) if args.out_root else os.path.join(
        os.path.dirname(os.path.expanduser(cfg["train"]["output_dir"]).rstrip("/")), "eval")
    out_dir = os.path.join(out_root, tag)
    os.makedirs(out_dir, exist_ok=True)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32
    print(f"model={args.model} adapter={args.adapter or '-'} device={device} dtype={dtype} "
          f"samples={len(rows)} batch={batch_size} beam={beam}", flush=True)

    from transformers import WhisperForConditionalGeneration, WhisperProcessor
    t_load = time.time()
    processor = WhisperProcessor.from_pretrained(args.model)
    model = WhisperForConditionalGeneration.from_pretrained(args.model, dtype=dtype)
    if args.adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, os.path.expanduser(args.adapter)).merge_and_unload()
    model = model.to(device).eval()
    print(f"loaded in {time.time()-t_load:.1f}s", flush=True)

    hyps, refs_raw = [], []
    audio_sec = 0.0
    t0 = time.time()
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        audios = [read_audio(r["audio"]) for r in batch]
        audio_sec += sum(len(a) for a in audios) / 16000
        feats = processor.feature_extractor(audios, sampling_rate=16000, return_tensors="pt").input_features
        feats = feats.to(device=device, dtype=dtype)
        with torch.inference_mode():
            ids = model.generate(feats, language=language, task=task, num_beams=beam, max_new_tokens=128)
        hyps.extend(processor.batch_decode(ids, skip_special_tokens=True))
        refs_raw.extend(r["text"] for r in batch)
        done = i + len(batch)
        if done % (batch_size * 25) == 0 or done == len(rows):
            print(f"  {done}/{len(rows)}  {time.time()-t0:.0f}s", flush=True)
    wall = time.time() - t0

    refs_ns = [normalize_for_cer(r) for r in refs_raw]
    hyps_ns = [normalize_for_cer(h) for h in hyps]
    refs_sp = [normalize_for_cer(r, keep_space=True) for r in refs_raw]
    hyps_sp = [normalize_for_cer(h, keep_space=True) for h in hyps]

    metrics = {
        "model": args.model, "adapter": args.adapter or None, "manifest": manifest,
        "samples": len(rows), "audio_hours": round(audio_sec / 3600, 3),
        "cer_nospace": corpus_cer(refs_ns, hyps_ns),
        "cer_space": corpus_cer(refs_sp, hyps_sp),
        "sentence_acc": sum(r == h for r, h in zip(refs_ns, hyps_ns)) / len(rows),
        "rtf": wall / audio_sec if audio_sec else None,
        "wall_sec": round(wall, 1), "device": device, "beam": beam, "batch_size": batch_size,
        "by_subdomain": {}, "by_aihub_split": {},
    }
    for key in ("subdomain", "aihub_split"):
        groups = collections.defaultdict(list)
        for r, ref, hyp in zip(rows, refs_ns, hyps_ns):
            groups[r.get(key, "?")].append((ref, hyp))
        for g, pairs in sorted(groups.items()):
            metrics["by_" + key][g] = {
                "n": len(pairs),
                "cer_nospace": corpus_cer([p[0] for p in pairs], [p[1] for p in pairs]),
                "sentence_acc": sum(p[0] == p[1] for p in pairs) / len(pairs),
            }

    with open(os.path.join(out_dir, "metrics.json"), "w", encoding="utf-8") as f:
        json.dump(metrics, f, ensure_ascii=False, indent=2)
    with open(os.path.join(out_dir, "predictions.tsv"), "w", encoding="utf-8") as f:
        f.write("wav\tref\thyp\tcer\n")
        for r, ref, hyp, rn, hn in zip(rows, refs_raw, hyps, refs_ns, hyps_ns):
            c = jiwer.cer(rn, hn if hn else " ") if rn else ""
            f.write(f"{os.path.basename(r['audio'])}\t{ref}\t{hyp.strip()}\t{c if c == '' else round(c, 4)}\n")

    print(f"\n== {tag} ==  samples {len(rows)}  audio {audio_sec/3600:.2f} h")
    print(f"CER(공백 제거) {metrics['cer_nospace']*100:.2f}%   CER(공백 유지) {metrics['cer_space']*100:.2f}%   "
          f"문장 정확도 {metrics['sentence_acc']*100:.1f}%   RTF {metrics['rtf']:.3f}")
    for g, m in metrics["by_subdomain"].items():
        print(f"  {g:14s} n={m['n']:5d}  CER {m['cer_nospace']*100:6.2f}%  acc {m['sentence_acc']*100:5.1f}%")
    print("wrote", out_dir)


if __name__ == "__main__":
    main()
