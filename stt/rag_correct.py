"""RAG 기반 교통 고유명사 보정 (계획서 5.5.2, API 명세 /stt 의 corrected_text·entities).

흐름: 1차 인식(raw_text, 신뢰도) → 장소로 보이는 구간 추출 → 지식베이스 하이브리드 검색(후보 K개)
     → 후보 이름을 Whisper 프롬프트(이전 문맥)에 넣고 같은 음성을 재디코딩 → 보정 전사 선택

usage (평가):
  python rag_correct.py --config config.yaml --split test --max-samples 200 --kiosk KIOSK_JONGNO_01
  python rag_correct.py --config config.yaml --split test --adapter ~/senior-voice/runs/lora-v1/adapter
출력: 보정 전/후 CER, 문장 정확도, 고유명사 정확도(정답에 지식베이스 이름이 들어 있는 발화 기준), 단계별 시간
"""
import argparse
import collections
import json
import os
import re
import sys
import time

import jiwer
import soundfile as sf
import torch
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "kb"))
from text_norm import normalize_for_cer  # noqa: E402
from normalize import normalize_name  # noqa: E402
from search import TransitKB  # noqa: E402

# 장소가 아닌데 자주 나오는 말 (후보 검색에서 제외)
STOPWORDS = {
    "출구", "시간", "시각", "정보", "방법", "안내", "승차권", "직원", "버스", "지하철", "전철", "노선", "열차", "환승",
    "정류장", "정류소", "요금", "첫차", "막차", "배차", "간격", "표", "카드", "현금", "결제", "자리", "역무원",
    "고객센터", "화장실", "편의점", "편의시설", "엘리베이터", "계단", "출발", "도착", "검색", "조회", "확인",
    "부탁", "알려", "찾아", "보여", "가는", "타는", "내리는", "여기", "거기", "저기", "지금", "오늘", "내일",
    "갈때", "갈수", "합니까", "합니다", "어디서", "어디로", "어디", "언제", "몇시", "몇번", "다음", "이번", "한번",
    "설명", "위치", "목적지", "호선", "기차표", "기차", "성인", "어른", "노인", "경로", "최단", "가까운", "근처",
    "어느", "번", "몇", "안에", "밖에", "쪽", "설정", "선택", "입력", "등록", "열차", "전동차", "승강장", "개찰구",
    # 짧은 역 이름(가양, 가산, 수서, 약수 …)과 부딪히는 동사·부사
    "가야", "가서", "가면", "가고", "가자", "가요", "가게", "가니", "가는데", "타야", "타서", "타면", "타고", "내려", "와서",
    "오면", "있어", "없어", "알아", "몰라", "해줘", "하게", "되나", "있는", "없는", "거기", "이거", "그거", "저거",
    "빨리", "바로", "많이", "적게", "하나", "두장", "한장", "세장",
}
PARTICLES = re.compile(r"(까지|으로|로|에서|에게|한테|이요|예요|이에요|은|는|이|가|을|를|에|요|도|행|방면|쪽)$")
# 구간이 장소일 가능성을 높이는 단서: 구간 안(…역/…정류장), 바로 앞 단어, 바로 뒤 단어
CUE_IN = re.compile(r"(역|정류장|정류소|터미널|공항|병원|시장|학교|공원|사거리|입구)$")
CUE_BEFORE = re.compile(r"(목적지|행선지|출발지|여기서|거기서|에서|부터)$")
CUE_AFTER = re.compile(r"^(까지|으로|로|에서|에|행|방면|쪽|가는|가려면|갈|도착|출발|내리|타|환승|근처|앞|안에|"
                       r"고객센터|역무실|출구|승강장|개찰구|화장실|어느|몇)")


LINE_NAME = re.compile(r"(호선|분당선|경의선|중앙선|경춘선|수인선|신설선|신림선|서해선|경강선|공항철도|골드라인|에버라인|선$)")


def _word_core(w: str) -> str:
    return PARTICLES.sub("", normalize_name(w))


class RagCorrector:
    def __init__(self, cfg, model, processor, device, kb=None):
        r = cfg.get("rag", {})
        self.cfg = r
        self.kb = kb or TransitKB(r.get("kb_dir", "~/data/kb"), tuple(r.get("weights", (0.5, 0.3, 0.2))),
                                  float(r.get("geo_radius_m", 5000)))
        self.model, self.processor, self.device = model, processor, device
        self.language = cfg.get("models", {}).get("language", "ko")
        self.task = cfg.get("models", {}).get("task", "transcribe")
        self.span_min = float(r.get("span_min_sim", 0.72))
        self.span_min_nocue = float(r.get("span_min_sim_nocue", 0.85))
        self.sub_min = float(r.get("substitute_min_sim", 0.85))
        self.max_extra_edits = int(r.get("max_extra_edits", 2))
        self.skip_conf = float(r.get("skip_if_confidence_above", 0.92))
        self.max_names = int(r.get("prompt_max_names", 8))
        self._search_cache = {}

    # ---------------------------------------------------------- 1차 인식 + 신뢰도
    @torch.inference_mode()
    def transcribe(self, audio, prompt_ids=None):
        feats = self.processor.feature_extractor(audio, sampling_rate=16000, return_tensors="pt").input_features
        feats = feats.to(self.device, dtype=self.model.dtype)
        kwargs = dict(language=self.language, task=self.task, max_new_tokens=128,
                      output_scores=True, return_dict_in_generate=True)
        if prompt_ids is not None:
            kwargs["prompt_ids"] = prompt_ids.to(self.device)
        out = self.model.generate(feats, **kwargs)
        seq = out.sequences
        text = self.processor.batch_decode(seq, skip_special_tokens=True)[0].strip()
        # 평균 로그확률 기반 신뢰도 (0~1)
        try:
            scores = self.model.compute_transition_scores(seq, out.scores, normalize_logits=True)
            lp = scores[0]
            lp = lp[torch.isfinite(lp)]
            conf = float(torch.exp(lp.mean())) if lp.numel() else 0.0
        except Exception:  # noqa: BLE001
            conf = 0.0
        return text, conf

    # ---------------------------------------------------------- 장소 구간 추출
    def _search(self, core, kiosk_xy):
        key = (core, kiosk_xy)
        if key not in self._search_cache:
            self._search_cache[key] = self.kb.search(core, kiosk_xy, k=5)
        return self._search_cache[key]

    def extract_spans(self, text, kiosk_xy=None):
        words = text.split()
        spans = []
        pos = 0
        starts = []
        for w in words:  # 각 단어의 원문 위치
            pos = text.find(w, pos)
            starts.append(pos)
            pos += len(w)
        for n in (3, 2, 1):
            for i in range(len(words) - n + 1):
                chunk = " ".join(words[i:i + n])
                core = PARTICLES.sub("", normalize_name(chunk))
                if len(core) < 2 or core in STOPWORDS or not re.search(r"[가-힣]", core):
                    continue
                if LINE_NAME.search(core):
                    continue  # 노선 이름(분당선, 4호선)은 장소가 아니다 → "분당선→신분당선" 같은 치환 방지
                if n > 1 and any(_word_core(w) in STOPWORDS for w in words[i:i + n]):
                    continue  # "선능력 어느 출구에" 처럼 일반 단어가 섞인 구간은 보지 않는다
                # 단서: 구간이 역/정류장 등으로 끝나거나, 조사가 붙어 있었거나, 앞뒤 단어가 교통 표현
                prv = words[i - 1] if i > 0 else ""
                nxt = words[i + n] if i + n < len(words) else ""
                has_cue = bool(CUE_IN.search(core) or PARTICLES.search(normalize_name(chunk))
                               or CUE_AFTER.match(nxt) or CUE_BEFORE.search(_word_core(prv)))
                if not has_cue and len(core) < 3:
                    continue  # 단서 없는 두 글자(가야, 수서 …)는 장소로 보지 않는다
                cands = self._search(core, kiosk_xy)
                if not cands:
                    continue
                need = self.span_min if has_cue else self.span_min_nocue
                if cands[0]["jamo_sim"] < need:
                    continue
                start = starts[i]
                end = starts[i + n - 1] + len(words[i + n - 1])
                spans.append({"span": text[start:end], "core": core, "start": start, "end": end,
                              "candidates": cands, "words": (i, i + n), "cue": has_cue})
        # 겹치는 구간은 문자열 유사도가 높은 것만 (같으면 긴 구간)
        spans.sort(key=lambda s: (-s["candidates"][0]["jamo_sim"], -(s["words"][1] - s["words"][0])))
        taken, kept = set(), []
        for s in spans:
            rng = set(range(*s["words"]))
            if rng & taken:
                continue
            taken |= rng
            kept.append(s)
        kept.sort(key=lambda s: s["start"])
        return kept

    # ---------------------------------------------------------- 보정
    def correct(self, audio, raw_text, confidence, kiosk_xy=None, use_rag=True):
        t0 = time.time()
        result = {"raw_text": raw_text, "corrected_text": raw_text, "confidence": round(confidence, 4),
                  "rag_applied": False, "entities": [], "stage_latency_ms": {}}
        if not use_rag or not raw_text:
            return result
        spans = self.extract_spans(raw_text, kiosk_xy)
        result["entities"] = [{"span": s["span"], "start": s["start"], "end": s["end"],
                               "candidates": [{k: c[k] for k in ("poi_id", "name", "poi_type", "score", "matched")}
                                              for c in s["candidates"]]} for s in spans]
        result["stage_latency_ms"]["search"] = int((time.time() - t0) * 1000)
        if not spans or confidence >= self.skip_conf:
            return result

        # 이미 지식베이스 표기와 똑같이 인식된 구간은 고칠 것이 없다
        fix_spans = [s for s in spans if s["candidates"][0]["matched"] != s["core"]]
        if not fix_spans:
            return result

        # 후보 표기(사람이 부르는 형태 = matched)로 프롬프트 재디코딩
        names = []
        for s in fix_spans:
            for c in s["candidates"][:3]:
                if c["jamo_sim"] >= 0.6 and c["matched"] not in names:
                    names.append(c["matched"])
        names = names[: self.max_names]
        t1 = time.time()
        prompt = ", ".join(names)
        prompt_ids = self.processor.get_prompt_ids(prompt, return_tensors="pt")
        redecoded, conf2 = self.transcribe(audio, prompt_ids)
        if redecoded.startswith(prompt):
            redecoded = redecoded[len(prompt):].strip(" ,.")
        result["stage_latency_ms"]["redecode"] = int((time.time() - t1) * 1000)

        corrected = raw_text
        raw_n, red_n = normalize_name(raw_text), normalize_name(redecoded)
        hit = any(n in red_n and n not in raw_n for n in names)
        # 장소 구간 밖까지 바뀌었으면(환각) 거부: 전체 편집 수 - 구간 길이 ≤ 허용치
        import rapidfuzz.distance.Levenshtein as Lev
        extra = Lev.distance(raw_n, red_n) - sum(len(s["core"]) for s in fix_spans)
        if hit and redecoded and extra <= self.max_extra_edits:
            corrected = redecoded
            result["rag_applied"] = True
            result["confidence"] = round(conf2, 4)
        else:
            # 재디코딩이 후보를 못 살리면 유사도 높은 구간만 직접 치환 ("선능력까지?" → "선릉역까지?")
            for s in sorted(fix_spans, key=lambda s: -s["start"]):
                top = s["candidates"][0]
                need = self.sub_min - (0.06 if CUE_IN.search(s["core"]) else 0.0)  # "…역"으로 끝나면 조금 관대하게
                # 발음 키만으로 비슷한 경우(인천→신정)는 치환하지 않는다: 순수 자모 유사도도 어느 정도 있어야 함
                if top["jamo_sim"] >= need and top.get("jamo_only", 1.0) >= 0.7:
                    m = PARTICLES.search(normalize_name(s["span"]))
                    particle = m.group(0) if m else ""
                    tail = re.search(r"[^\w가-힣]+$", s["span"])
                    punct = tail.group(0) if tail else ""
                    corrected = corrected[: s["start"]] + top["matched"] + particle + punct + corrected[s["end"]:]
                    result["rag_applied"] = True
        result["corrected_text"] = corrected
        return result


# ---------------------------------------------------------------- 평가
def proper_nouns_in(ref_norm, kb_names):
    """정답(공백 제거)에 들어 있는 지식베이스 이름들 (긴 것 우선, 겹치지 않게)"""
    found = []
    for n in kb_names:
        if n in ref_norm and not any(n in f for f in found):
            found.append(n)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=os.path.join(HERE, "config.yaml"))
    ap.add_argument("--split", default="test")
    ap.add_argument("--model", default=None)
    ap.add_argument("--adapter", default="")
    ap.add_argument("--kiosk", default="KIOSK_JONGNO_01")
    ap.add_argument("--max-samples", type=int, default=200)
    ap.add_argument("--only-proper", action="store_true", help="정답에 지식베이스 이름이 있는 발화만 평가")
    ap.add_argument("--out", default="")
    args = ap.parse_args()
    with open(args.config, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    model_id = args.model or cfg["models"]["finetune_base"]
    kiosk = cfg["rag"]["kiosks"].get(args.kiosk)
    kiosk_xy = (kiosk["x"], kiosk["y"]) if kiosk else None

    manifest = os.path.join(os.path.expanduser(cfg["data"]["manifest_dir"]), f"{args.split}.jsonl")
    rows = [json.loads(l) for l in open(manifest, encoding="utf-8") if l.strip()]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32
    from transformers import WhisperForConditionalGeneration, WhisperProcessor
    processor = WhisperProcessor.from_pretrained(model_id)
    model = WhisperForConditionalGeneration.from_pretrained(model_id, dtype=dtype)
    if args.adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, os.path.expanduser(args.adapter)).merge_and_unload()
    model = model.to(device).eval()
    rc = RagCorrector(cfg, model, processor, device)

    # 고유명사 평가용 이름 목록: 역·정류장 정식 이름(3자 이상)만
    kb_names = sorted({r[0] for r in rc.kb.con.execute("SELECT name_norm FROM transit_poi WHERE length(name_norm)>=3")},
                      key=len, reverse=True)
    if args.only_proper:
        rows = [r for r in rows if proper_nouns_in(normalize_for_cer(r["text"]), kb_names)]
    rows = rows[: args.max_samples]
    print(f"model={model_id} adapter={args.adapter or '-'} samples={len(rows)} kiosk={args.kiosk} kb={rc.kb.dir}", flush=True)

    refs, raws, cors = [], [], []
    pn_total = pn_raw_ok = pn_cor_ok = 0
    applied = 0
    lat = collections.defaultdict(float)
    records = []
    t_all = time.time()
    for i, r in enumerate(rows, 1):
        audio, _ = sf.read(r["audio"], dtype="float32", always_2d=True)
        audio = audio.mean(axis=1)
        t0 = time.time()
        raw, conf = rc.transcribe(audio)
        lat["stt"] += time.time() - t0
        t1 = time.time()
        res = rc.correct(audio, raw, conf, kiosk_xy)
        lat["rag"] += time.time() - t1
        applied += res["rag_applied"]
        ref_n = normalize_for_cer(r["text"])
        raw_n, cor_n = normalize_for_cer(raw), normalize_for_cer(res["corrected_text"])
        refs.append(ref_n); raws.append(raw_n or " "); cors.append(cor_n or " ")
        pns = proper_nouns_in(ref_n, kb_names)
        for n in pns:
            pn_total += 1
            pn_raw_ok += n in raw_n
            pn_cor_ok += n in cor_n
        records.append({"wav": os.path.basename(r["audio"]), "ref": r["text"], "raw": raw, "corrected": res["corrected_text"],
                        "confidence": res["confidence"], "rag_applied": res["rag_applied"], "proper_nouns": pns,
                        "entities": [{"span": e["span"], "top": e["candidates"][0]["name"] if e["candidates"] else None} for e in res["entities"]]})
        if i % 50 == 0:
            print(f"  {i}/{len(rows)}  {time.time()-t_all:.0f}s", flush=True)

    cer_raw, cer_cor = jiwer.cer(refs, raws), jiwer.cer(refs, cors)
    acc_raw = sum(a == b for a, b in zip(refs, raws)) / len(refs)
    acc_cor = sum(a == b for a, b in zip(refs, cors)) / len(refs)
    n = len(rows)
    print(f"\n== RAG 보정 결과 ({n}발화) ==")
    print(f"CER        : {cer_raw*100:.2f}% → {cer_cor*100:.2f}%")
    print(f"문장 정확도 : {acc_raw*100:.1f}% → {acc_cor*100:.1f}%")
    if pn_total:
        print(f"고유명사 정확도 ({pn_total}개): {pn_raw_ok/pn_total*100:.1f}% → {pn_cor_ok/pn_total*100:.1f}%")
    print(f"RAG 적용 발화: {applied}/{n}   평균 지연 stt {lat['stt']/n*1000:.0f}ms, rag {lat['rag']/n*1000:.0f}ms")
    if args.out:
        with open(os.path.expanduser(args.out), "w", encoding="utf-8") as f:
            for rec in records:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        print("wrote", args.out)


if __name__ == "__main__":
    main()
