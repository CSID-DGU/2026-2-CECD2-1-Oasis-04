"""Whisper LoRA 파인튜닝 (PEFT). 설정은 전부 config.yaml 에서 읽는다.

usage:
  python train_lora.py --config config.yaml                       # 본 학습 (대여 GPU)
  python train_lora.py --config config.yaml --smoke               # 로컬 동작 확인: 샘플 300개, 1 epoch, 평가 50개
  python train_lora.py --config config.yaml --max-train-samples 2000 --epochs 1 --output-dir ~/senior-voice/runs/try1

출력 (train.output_dir):
  adapter/            LoRA 어댑터 + 프로세서 (eval_baseline.py --adapter 로 평가)
  checkpoint-*/       학습 중 체크포인트 (save_total_limit 개 유지)
  runs/               TensorBoard 로그 (tensorboard --logdir <output_dir>/runs)
  train_summary.json  설정·스텝 수·최종/최고 dev CER

메모: 음성 특징(log-mel)은 디스크에 저장하지 않고 DataLoader 에서 그때그때 계산한다 (24시간 분량을 미리 계산하면 30GB).
"""
import argparse
import json
import os
import sys
import time
from dataclasses import dataclass

import jiwer
import soundfile as sf
import torch
import yaml
from torch.utils.data import Dataset

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from text_norm import normalize_for_cer  # noqa: E402


# ---------------------------------------------------------------- data
class ManifestDataset(Dataset):
    """jsonl 매니페스트 한 줄 → {"input_features": (n_mels, 3000) tensor, "labels": [token ids]}"""

    def __init__(self, path, processor, max_samples=0, max_label_len=448):
        self.rows = []
        with open(os.path.expanduser(path), encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    self.rows.append(json.loads(line))
        if max_samples:
            self.rows = self.rows[:max_samples]
        self.fe = processor.feature_extractor
        self.tok = processor.tokenizer
        self.max_label_len = max_label_len

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        r = self.rows[i]
        audio, sr = sf.read(r["audio"], dtype="float32", always_2d=True)
        audio = audio.mean(axis=1)
        if sr != 16000:
            raise ValueError(f"{r['audio']}: {sr} Hz (16 kHz 필요)")
        feats = self.fe(audio, sampling_rate=16000, return_tensors="pt").input_features[0]
        labels = self.tok(r["text"]).input_ids[: self.max_label_len]
        return {"input_features": feats, "labels": labels}


@dataclass
class DataCollatorSpeechSeq2SeqWithPadding:
    processor: object
    decoder_start_token_id: int

    def __call__(self, features):
        input_features = [{"input_features": f["input_features"]} for f in features]
        batch = self.processor.feature_extractor.pad(input_features, return_tensors="pt")
        label_features = [{"input_ids": f["labels"]} for f in features]
        labels_batch = self.processor.tokenizer.pad(label_features, return_tensors="pt")
        labels = labels_batch["input_ids"].masked_fill(labels_batch.attention_mask.ne(1), -100)
        # 토크나이저가 앞에 붙인 <|startoftranscript|> 는 모델이 shift 하면서 다시 넣으므로 제거
        if (labels[:, 0] == self.decoder_start_token_id).all().cpu().item():
            labels = labels[:, 1:]
        batch["labels"] = labels
        return batch


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(os.path.dirname(__file__), "config.yaml"))
    ap.add_argument("--smoke", action="store_true", help="샘플 300/평가 50, 1 epoch, 20스텝마다 평가")
    ap.add_argument("--max-train-samples", type=int, default=None)
    ap.add_argument("--max-eval-samples", type=int, default=None)
    ap.add_argument("--epochs", type=float, default=None)
    ap.add_argument("--output-dir", default=None)
    ap.add_argument("--base-model", default=None)
    args = ap.parse_args()

    with open(args.config, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    tcfg, lcfg, mcfg = cfg["train"], cfg["lora"], cfg["models"]
    manifest_dir = os.path.expanduser(cfg["data"]["manifest_dir"])

    base_model = args.base_model or mcfg["finetune_base"]
    output_dir = os.path.expanduser(args.output_dir or tcfg["output_dir"])
    max_train = args.max_train_samples if args.max_train_samples is not None else int(tcfg.get("max_train_samples", 0))
    max_eval = args.max_eval_samples if args.max_eval_samples is not None else int(tcfg.get("max_eval_samples", 0))
    epochs = args.epochs if args.epochs is not None else float(tcfg.get("num_epochs", 3))
    eval_steps = int(tcfg.get("eval_every_steps", 500))
    save_steps = int(tcfg.get("save_every_steps", 500))
    if args.smoke:
        max_train, max_eval, epochs, eval_steps, save_steps = 300, 50, 1.0, 20, 20
        output_dir = os.path.join(os.path.dirname(output_dir.rstrip("/")), "smoke")
    os.makedirs(output_dir, exist_ok=True)

    from peft import LoraConfig, get_peft_model
    from transformers import (EarlyStoppingCallback, Seq2SeqTrainer, Seq2SeqTrainingArguments,
                              WhisperForConditionalGeneration, WhisperProcessor)

    language = mcfg.get("language", "ko")
    lang_name = {"ko": "korean"}.get(language, language)
    task = mcfg.get("task", "transcribe")

    processor = WhisperProcessor.from_pretrained(base_model)
    processor.tokenizer.set_prefix_tokens(language=lang_name, task=task)

    train_ds = ManifestDataset(os.path.join(manifest_dir, "train.jsonl"), processor, max_train)
    eval_ds = ManifestDataset(os.path.join(manifest_dir, "dev.jsonl"), processor, max_eval)
    print(f"train {len(train_ds)}  dev {len(eval_ds)}  base {base_model}  out {output_dir}", flush=True)

    model = WhisperForConditionalGeneration.from_pretrained(base_model, dtype=torch.float32)
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []
    model.generation_config.forced_decoder_ids = None
    model.generation_config.language = language
    model.generation_config.task = task
    if tcfg.get("gradient_checkpointing", True):
        model.gradient_checkpointing_enable()
        model.enable_input_require_grads()  # 체크포인팅 + 동결된 입력에서 LoRA 로 grad 가 흐르게

    lora = LoraConfig(
        r=int(lcfg["r"]), lora_alpha=int(lcfg["alpha"]), lora_dropout=float(lcfg["dropout"]),
        target_modules=list(lcfg["target_modules"]), bias="none",
    )
    model = get_peft_model(model, lora)
    model.print_trainable_parameters()

    collator = DataCollatorSpeechSeq2SeqWithPadding(processor, model.config.decoder_start_token_id)

    def compute_metrics(pred):
        pred_ids = pred.predictions
        label_ids = pred.label_ids.copy()
        label_ids[label_ids == -100] = processor.tokenizer.pad_token_id
        hyps = processor.tokenizer.batch_decode(pred_ids, skip_special_tokens=True)
        refs = processor.tokenizer.batch_decode(label_ids, skip_special_tokens=True)
        r = [normalize_for_cer(x) for x in refs]
        h = [normalize_for_cer(x) or " " for x in hyps]
        keep = [i for i, x in enumerate(r) if x]
        cer = jiwer.cer([r[i] for i in keep], [h[i] for i in keep]) if keep else 1.0
        acc = sum(r[i] == h[i].strip() for i in keep) / max(1, len(keep))
        return {"cer": cer, "sentence_acc": acc}

    use_fp16 = bool(tcfg.get("fp16", True)) and torch.cuda.is_available()
    targs = Seq2SeqTrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=int(tcfg["per_device_batch_size"]),
        per_device_eval_batch_size=int(tcfg.get("eval_batch_size", tcfg["per_device_batch_size"])),
        gradient_accumulation_steps=int(tcfg["grad_accum"]),
        learning_rate=float(tcfg["learning_rate"]),
        warmup_steps=float(tcfg.get("warmup_ratio", 0.05)),  # transformers 5.x: 0~1 실수면 전체 스텝 대비 비율
        num_train_epochs=epochs,
        lr_scheduler_type="linear",
        fp16=use_fp16,
        gradient_checkpointing=bool(tcfg.get("gradient_checkpointing", True)),
        gradient_checkpointing_kwargs={"use_reentrant": False},
        eval_strategy="steps", eval_steps=eval_steps,
        save_strategy="steps", save_steps=save_steps, save_total_limit=2,
        logging_steps=int(tcfg.get("logging_steps", 10)),
        report_to=["tensorboard"],  # 로그는 <output_dir>/runs/ 에 쌓임
        predict_with_generate=True, generation_max_length=128,
        load_best_model_at_end=True, metric_for_best_model="cer", greater_is_better=False,
        dataloader_num_workers=int(tcfg.get("num_workers", 4)),
        remove_unused_columns=False, label_names=["labels"],
        seed=int(tcfg.get("seed", 42)),
    )
    trainer = Seq2SeqTrainer(
        model=model, args=targs, train_dataset=train_ds, eval_dataset=eval_ds,
        data_collator=collator, compute_metrics=compute_metrics,
        processing_class=processor.feature_extractor,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=int(tcfg.get("early_stopping_patience", 3)))],
    )

    t0 = time.time()
    result = trainer.train()
    final = trainer.evaluate()
    adapter_dir = os.path.join(output_dir, "adapter")
    model.save_pretrained(adapter_dir)
    processor.save_pretrained(adapter_dir)

    summary = {
        "base_model": base_model, "lora": lcfg, "train_cfg": tcfg,
        "train_samples": len(train_ds), "eval_samples": len(eval_ds), "epochs": epochs,
        "global_steps": trainer.state.global_step, "train_minutes": round((time.time() - t0) / 60, 1),
        "train_loss": result.training_loss, "best_dev_cer": trainer.state.best_metric,
        "final_dev": {k: v for k, v in final.items()}, "adapter_dir": adapter_dir,
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu",
        "peak_vram_gb": round(torch.cuda.max_memory_allocated() / 2**30, 2) if torch.cuda.is_available() else None,
    }
    with open(os.path.join(output_dir, "train_summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2, default=str)
    print(json.dumps({k: summary[k] for k in ("global_steps", "train_minutes", "train_loss", "best_dev_cer", "peak_vram_gb", "adapter_dir")},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
