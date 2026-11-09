"""STT 파트 API (명세 v0.1 의 /health, /stt, /resolve). FastAPI 라우터 + 단독 실행.

서버 파트는 이 라우터를 마운트하면 된다 (FastAPI lifespan 안에서 startup() 호출):
    from stt.api import router, startup
    app.include_router(router)   # 서버의 lifespan 에서 startup() 을 한 번 부른다
단독 실행 (Swagger: http://localhost:8000/docs):
    cd ~/senior-voice && .venv/bin/python -m stt.api  --또는--  .venv/bin/uvicorn stt.api:app --port 8000
환경변수: STT_CONFIG(기본 stt/config.yaml), STT_ADAPTER(LoRA 어댑터 폴더, 없으면 기본 Whisper), STT_MODEL(기본 모델 덮어쓰기)

음성은 메모리에서만 처리하고 디스크에 저장하지 않는다 (NFR-04).
"""
import io
import json
import os
import subprocess
import sys
import time
from typing import Optional

import numpy as np
import soundfile as sf
import yaml
from fastapi import APIRouter, FastAPI, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "kb"))
from intent import classify, confirm_text  # noqa: E402
from normalize import normalize_name  # noqa: E402
from rag_correct import RagCorrector  # noqa: E402
from search import TransitKB  # noqa: E402

VERSION = "0.1.0"
MAX_SECONDS = 30
MAX_BYTES = 5 * 1024 * 1024
CONFIRM_THRESHOLD = 0.8     # 1순위 점수가 이보다 낮으면 확인 질문
CONFIRM_MARGIN = 0.1        # 1·2순위 차가 이보다 작으면 확인 질문

EASY = {
    "EMPTY_AUDIO": "소리가 잘 들리지 않았어요. 한 번 더 말씀해 주세요.",
    "AUDIO_TOO_LONG": "말씀이 조금 길었어요. 짧게 한 번 더 말씀해 주세요.",
    "UNSUPPORTED_AUDIO": "음성을 처리할 수 없어요. 잠시 후 다시 시도해 주세요.",
    "KIOSK_NOT_FOUND": "기기 설정에 문제가 있어요. 직원에게 알려 주세요.",
    "MODEL_NOT_READY": "준비 중이에요. 잠시 후 다시 말씀해 주세요.",
    "NO_CANDIDATE": "어디로 가실지 잘 못 알아들었어요. 한 번 더 말씀해 주세요.",
    "VALIDATION_ERROR": "잠시 문제가 생겼어요. 처음 화면으로 돌아갈게요.",
    "INTERNAL_ERROR": "잠시 문제가 생겼어요. 처음 화면으로 돌아갈게요.",
}
HTTP = {"EMPTY_AUDIO": 400, "AUDIO_TOO_LONG": 413, "UNSUPPORTED_AUDIO": 415, "KIOSK_NOT_FOUND": 404,
        "MODEL_NOT_READY": 503, "NO_CANDIDATE": 200, "VALIDATION_ERROR": 400, "INTERNAL_ERROR": 500}


def fail(code: str, message: str, t0: float):
    return JSONResponse(status_code=HTTP[code], content={
        "success": False, "error": {"code": code, "message": message, "easy_message": EASY[code]},
        "latency_ms": int((time.time() - t0) * 1000)})


def ok(data: dict, t0: float):
    return {"success": True, "data": data, "latency_ms": int((time.time() - t0) * 1000)}


# ---------------------------------------------------------------- state
class State:
    cfg: dict = {}
    kb: Optional[TransitKB] = None
    rc: Optional[RagCorrector] = None
    model_name: str = ""
    engine: str = "base"
    kiosks: dict = {}
    kb_meta: dict = {}
    loaded: bool = False


S = State()


def startup():
    import torch
    from transformers import WhisperForConditionalGeneration, WhisperProcessor

    cfg_path = os.environ.get("STT_CONFIG", os.path.join(HERE, "config.yaml"))
    with open(cfg_path, encoding="utf-8") as f:
        S.cfg = yaml.safe_load(f)
    r = S.cfg.get("rag", {})
    S.kiosks = r.get("kiosks", {})
    S.kb = TransitKB(r.get("kb_dir", "~/data/kb_seoul"), tuple(r.get("weights", (0.8, 0.1, 0.1))),
                     float(r.get("geo_radius_m", 20000)))
    S.kb_meta = json.load(open(os.path.join(S.kb.dir, "meta.json"), encoding="utf-8"))

    model_id = os.environ.get("STT_MODEL") or S.cfg["models"]["finetune_base"]
    adapter = os.environ.get("STT_ADAPTER", "")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32
    processor = WhisperProcessor.from_pretrained(model_id)
    model = WhisperForConditionalGeneration.from_pretrained(model_id, dtype=dtype)
    if adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, os.path.expanduser(adapter)).merge_and_unload()
        S.engine = "finetuned"
    model = model.to(device).eval()
    S.rc = RagCorrector(S.cfg, model, processor, device, kb=S.kb)
    S.model_name = model_id.split("/")[-1] + (f" + {os.path.basename(adapter.rstrip('/'))}" if adapter else "")
    S.loaded = True
    # 워밍업 (첫 요청 지연 제거)
    S.rc.transcribe(np.zeros(16000, dtype=np.float32))
    S.kb.search("서울역", None, k=1)


# ---------------------------------------------------------------- audio
def decode_audio(raw: bytes, content_type: str) -> np.ndarray:
    """webm/wav/mp3 등 → 16 kHz mono float32. ffmpeg 를 파이프로만 써서 디스크에 남기지 않는다."""
    if content_type and "wav" in content_type:
        try:
            data, sr = sf.read(io.BytesIO(raw), dtype="float32", always_2d=True)
            data = data.mean(axis=1)
            if sr != 16000:
                import torch
                import torchaudio.functional as F
                data = F.resample(torch.from_numpy(data), sr, 16000).numpy()
            return data
        except Exception:  # noqa: BLE001 — 헤더가 이상하면 ffmpeg 로 재시도
            pass
    proc = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", "pipe:0", "-ac", "1", "-ar", "16000", "-f", "f32le", "pipe:1"],
        input=raw, capture_output=True, timeout=20)
    if proc.returncode != 0 or not proc.stdout:
        raise ValueError(proc.stderr.decode("utf-8", "ignore")[:200] or "ffmpeg failed")
    return np.frombuffer(proc.stdout, dtype=np.float32).copy()


def preprocess(audio: np.ndarray):
    """무음 제거 + 음량 정규화. (원본 길이 ms, 처리된 음성) 반환"""
    duration_ms = int(len(audio) / 16)
    if len(audio) == 0:
        return duration_ms, audio
    peak = float(np.abs(audio).max())
    if peak > 0:
        audio = audio / peak * 0.9
    # 간단한 에너지 기반 양끝 무음 제거 (20 ms 창)
    frame = 320
    n = len(audio) // frame
    if n > 2:
        energy = np.sqrt((audio[: n * frame].reshape(n, frame) ** 2).mean(axis=1))
        thr = max(0.01, float(energy.max()) * 0.05)
        voiced = np.where(energy > thr)[0]
        if voiced.size:
            s = max(0, (voiced[0] - 5) * frame)
            e = min(len(audio), (voiced[-1] + 6) * frame)
            audio = audio[s:e]
        else:
            audio = audio[:0]
    return duration_ms, audio


# ---------------------------------------------------------------- schemas
class Candidate(BaseModel):
    poi_id: str
    name: str
    display_name: str
    poi_type: str
    x: float
    y: float
    distance_m: Optional[int] = None
    score: float


class EntityCandidate(BaseModel):
    poi_id: str
    name: str
    poi_type: str
    score: float
    matched: Optional[str] = None


class Entity(BaseModel):
    span: str
    start: int
    end: int
    candidates: list[EntityCandidate]


class ResolveRequest(BaseModel):
    text: str = Field(..., description="/stt 의 corrected_text 또는 터치 입력 장소명")
    kiosk_id: str
    input_mode: str = Field("VOICE", description="VOICE / TOUCH")
    entities: Optional[list[Entity]] = Field(None, description="/stt 응답의 entities 를 그대로 넘기면 재검색을 줄인다")


def display_name(p: dict) -> str:
    if p["poi_type"] == "SUBWAY_STATION":
        line = (p.get("line_info") or "").split("/")[0].strip()
        base = p["name"] if p["name"].endswith("역") else p["name"] + "역"
        return f"{base} ({line})" if line else base
    if p["poi_type"] == "BUS_STOP":
        return f"{p['name']} 정류장"
    return p["name"]


def to_candidate(c: dict) -> dict:
    return {"poi_id": c["poi_id"], "name": c["name"], "display_name": display_name(c), "poi_type": c["poi_type"],
            "x": c["x"], "y": c["y"], "distance_m": c.get("distance_m"), "score": c["score"]}


_SUFFIX = __import__("re").compile(r"(역|정류장|정류소)$")


def dest_key(c: dict) -> str:
    """사람이 부른 이름 기준의 목적지 키. '청량리' 정류장·1호선·경의중앙선은 한 목적지로 본다"""
    base = c.get("matched") or c["name"]
    return _SUFFIX.sub("", normalize_name(base))


def collapse(cands: list[dict], k: int = 3) -> list[dict]:
    """같은 이름의 후보를 하나로 합친다 (점수 순, 비슷하면 지하철역 우선)."""
    groups: dict[str, dict] = {}
    for c in sorted(cands, key=lambda c: -c["score"]):
        key = dest_key(c)
        g = groups.get(key)
        if g is None:
            groups[key] = c
        elif c["poi_type"] == "SUBWAY_STATION" and g["poi_type"] != "SUBWAY_STATION" and c["score"] >= g["score"] - 0.02:
            groups[key] = c
    return list(groups.values())[:k]


def confirm_name(display: str) -> str:
    """확인 문장에는 괄호(노선 등)를 뺀 이름을 쓴다: '선릉역 (2호선)' → '선릉역'"""
    return __import__("re").sub(r"\s*\(.*?\)", "", display).strip()


# ---------------------------------------------------------------- routes
router = APIRouter(prefix="/api/v1", tags=["stt"])


@router.get("/health", summary="서버·STT 모델·지식베이스 상태")
def health():
    t0 = time.time()
    data = {
        "status": "ok" if S.loaded else "degraded",
        "version": VERSION,
        "stt": {"loaded": S.loaded, "engine": S.engine, "model": S.model_name},
        "knowledge_base": {"loaded": S.kb is not None, "poi_count": S.kb_meta.get("pois", 0),
                           "base_date": S.kb_meta.get("built_at", "")},
        "odsay": {"reachable": None},  # 서버 파트에서 채움
    }
    return ok(data, t0)


@router.post("/stt", summary="음성 → 전사 (RAG 고유명사 보정 포함)")
async def stt(audio: UploadFile = File(..., description="audio/webm 또는 audio/wav, 최대 30초·5MB"),
              kiosk_id: str = Form(...), use_rag: bool = Form(True)):
    t0 = time.time()
    if not S.loaded:
        return fail("MODEL_NOT_READY", "model loading", t0)
    kiosk = S.kiosks.get(kiosk_id)
    if not kiosk:
        return fail("KIOSK_NOT_FOUND", f"unknown kiosk_id {kiosk_id}", t0)
    raw = await audio.read()
    if len(raw) > MAX_BYTES:
        return fail("AUDIO_TOO_LONG", f"{len(raw)} bytes > {MAX_BYTES}", t0)
    if not raw:
        return fail("EMPTY_AUDIO", "no bytes", t0)
    t1 = time.time()
    try:
        wave = decode_audio(raw, audio.content_type or "")
    except Exception as e:  # noqa: BLE001
        return fail("UNSUPPORTED_AUDIO", f"decode failed: {e}", t0)
    duration_ms, wave = preprocess(wave)
    if duration_ms > MAX_SECONDS * 1000:
        return fail("AUDIO_TOO_LONG", f"{duration_ms} ms > {MAX_SECONDS * 1000}", t0)
    if len(wave) < 16000 * 0.3:
        return fail("EMPTY_AUDIO", f"voiced {len(wave)/16:.0f} ms", t0)
    t_pre = int((time.time() - t1) * 1000)

    t2 = time.time()
    raw_text, conf = S.rc.transcribe(wave)
    t_stt = int((time.time() - t2) * 1000)
    t3 = time.time()
    res = S.rc.correct(wave, raw_text, conf, (kiosk["x"], kiosk["y"]), use_rag=use_rag)
    t_rag = int((time.time() - t3) * 1000)
    if not raw_text.strip():
        return fail("EMPTY_AUDIO", "empty transcript", t0)
    return ok({
        "raw_text": raw_text, "corrected_text": res["corrected_text"], "confidence": res["confidence"],
        "rag_applied": res["rag_applied"], "entities": res["entities"],
        "audio_duration_ms": duration_ms,
        "stage_latency_ms": {"preprocess": t_pre, "stt": t_stt, "rag": t_rag},
    }, t0)


@router.post("/resolve", summary="전사 텍스트 → 의도·목적지 후보 (최대 3개)")
def resolve(req: ResolveRequest):
    t0 = time.time()
    if S.kb is None:
        return fail("MODEL_NOT_READY", "kb loading", t0)
    kiosk = S.kiosks.get(req.kiosk_id)
    if not kiosk:
        return fail("KIOSK_NOT_FOUND", f"unknown kiosk_id {req.kiosk_id}", t0)
    xy = (kiosk["x"], kiosk["y"])
    text = req.text.strip()
    if not text:
        return fail("VALIDATION_ERROR", "text is empty", t0)

    # 후보: /stt 가 넘긴 entities 재사용 → 없으면 장소 구간 추출(단서·유사도 조건) → 터치 입력은 문장 전체로 검색
    cands = []
    if req.entities:
        for e in req.entities:
            for c in e.candidates:
                p = S.kb.poi(c.poi_id)
                if p:
                    cands.append({**p, "score": c.score, "distance_m": None, "matched": c.matched})
    if not cands and S.rc is not None:
        for s in S.rc.extract_spans(text, xy):
            cands.extend(s["candidates"])
    if not cands:
        whole = S.kb.search(text, xy, k=5)
        # 음성은 "응 맞아" 같은 말도 어딘가와 약하게 닮기 마련이라, 거의 같은 이름일 때만 장소로 본다
        if whole and (req.input_mode == "TOUCH" or (whole[0]["jamo_sim"] >= 0.85 and len(text.split()) <= 3)):
            cands = whole
    groups = collapse(cands)

    # "뭐라고요?", "응 맞아" 같은 짧은 대화 응답이 어딘가와 약하게 닮아 장소로 잡히는 것을 막는다:
    # 확실한 장소(유사도 0.9 이상)가 없으면 대화 의도를 우선한다
    if req.input_mode != "TOUCH":
        ctl = classify(text, has_place=False)
        if ctl in ("AFFIRM", "DENY", "CANCEL", "REPEAT") and (not groups or groups[0].get("jamo_sim", groups[0]["score"]) < 0.9):
            return ok({"intent": ctl, "need_confirm": False, "confirm_text": None, "destination_candidates": []}, t0)

    if not groups:
        intent = "NAVIGATE" if req.input_mode == "TOUCH" else classify(text, has_place=False)
        if intent == "NAVIGATE":
            return fail("NO_CANDIDATE", "no destination candidate", t0)
        return ok({"intent": intent, "need_confirm": False, "confirm_text": None, "destination_candidates": []}, t0)

    top = groups[0]
    need = top["score"] < CONFIRM_THRESHOLD or (len(groups) > 1 and top["score"] - groups[1]["score"] < CONFIRM_MARGIN)
    out = [to_candidate(c) for c in groups]
    return ok({"intent": "NAVIGATE", "need_confirm": need, "confirm_text": confirm_text(confirm_name(out[0]["display_name"])),
               "destination_candidates": out}, t0)


# ---------------------------------------------------------------- app
from contextlib import asynccontextmanager  # noqa: E402


@asynccontextmanager
async def lifespan(_app: FastAPI):
    startup()
    yield


app = FastAPI(title="Senior Voice STT API", version=VERSION, lifespan=lifespan,
              description="어르신 음성 → 전사(RAG 보정) → 의도·목적지 후보. 명세 v0.1 의 /stt, /resolve, /health")
app.include_router(router)


@app.exception_handler(Exception)
async def on_error(request: Request, exc: Exception):
    return fail("INTERNAL_ERROR", f"{type(exc).__name__}: {exc}", time.time())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
