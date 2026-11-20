"""STT 파트 API (명세 v0.1 의 /health, /stt, /resolve + 프론트 연동용 /pois, /location). FastAPI 라우터 + 단독 실행.

대중교통 경로는 경로 서버(server/app.py, 기본 8000번 포트)가 따로 맡는다. 이 서버는 그와 겹치지 않게 8001번을 쓴다.
단독 실행 (Swagger: http://localhost:8001/docs):
    cd ~/senior-voice && .venv/bin/python stt/api.py
다른 FastAPI 앱에 붙이려면 이 라우터를 마운트한다 (그 앱의 lifespan 안에서 startup() 을 한 번 호출):
    from stt.api import router, startup
    app.include_router(router)
환경변수:
    PORT              단독 실행할 때의 포트 (기본 8001)
    STT_CONFIG        설정 파일 (기본 stt/config.yaml)
    STT_ADAPTER       LoRA 어댑터 폴더. 주지 않으면 설정 파일의 models.adapter 를 쓴다. none 이면 기본 Whisper
                      (지금 쓰는 어댑터를 /health 의 stt.model 로 확인할 수 있다)
    STT_MODEL         기본 모델 덮어쓰기
    FRONTEND_DIST     키오스크 화면 빌드 폴더 (기본 ../frontend/dist). 있으면 / 에서 함께 서빙한다
    STT_CORS_ORIGINS  다른 출처에서 부를 때 허용할 주소 (쉼표 구분. 기본: vite 개발 서버 http://localhost:5173)

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
from destination import (apply_context, category_question, choice_text, exact_candidates,  # noqa: E402
                         number_families, number_question, outside_region)
from intent import classify, confirm_text  # noqa: E402
from normalize import normalize_name  # noqa: E402
from origin import MAX_ACCURACY_M, MAX_DISTANCE_M, PLACE_NEAR_M, SNAP_M, fixed_place, locate, place_of  # noqa: E402
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
    "OUT_OF_SCOPE": "이 키오스크에서는 서울 안의 길만 안내할 수 있어요.",
    "POI_NOT_FOUND": "가실 곳을 찾지 못했어요. 처음부터 다시 해 주세요.",
    "ROUTE_TOO_CLOSE": "가까운 곳이라 걸어서 가실 수 있어요.",
    "ROUTE_NOT_FOUND": "가는 길을 찾지 못했어요.",
    "UPSTREAM_ERROR": "지금은 길 안내를 받아올 수 없어요. 잠시 후 다시 해 주세요.",
    "VALIDATION_ERROR": "잠시 문제가 생겼어요. 처음 화면으로 돌아갈게요.",
    "INTERNAL_ERROR": "잠시 문제가 생겼어요. 처음 화면으로 돌아갈게요.",
}
HTTP = {"EMPTY_AUDIO": 400, "AUDIO_TOO_LONG": 413, "UNSUPPORTED_AUDIO": 415, "KIOSK_NOT_FOUND": 404,
        "MODEL_NOT_READY": 503, "NO_CANDIDATE": 200, "OUT_OF_SCOPE": 200, "POI_NOT_FOUND": 404,
        "ROUTE_TOO_CLOSE": 422, "ROUTE_NOT_FOUND": 404, "UPSTREAM_ERROR": 502, "VALIDATION_ERROR": 400,
        "INTERNAL_ERROR": 500}


def fail(code: str, message: str, t0: float, easy: Optional[str] = None):
    """실패 응답. easy 를 주면 기본 쉬운 문장 대신 그 문장을 쓴다 (예: '약 600미터예요' 처럼 값이 들어가는 경우)."""
    return JSONResponse(status_code=HTTP[code], content={
        "success": False, "error": {"code": code, "message": message, "easy_message": easy or EASY[code]},
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
    location_cfg: dict = {}
    live_origin: dict = {}      # kiosk_id → 키오스크가 POST /location 으로 알린 현재 위치 (서버를 다시 띄우면 비워진다)
    kb_meta: dict = {}
    loaded: bool = False


S = State()


def pick_adapter(env_value: Optional[str], cfg_value: Optional[str]) -> str:
    """쓸 LoRA 어댑터 폴더를 정한다. 없으면 '' (기본 모델).

    환경변수 STT_ADAPTER 가 있으면 그것을, 없으면 설정 파일의 models.adapter 를 쓴다.
    STT_ADAPTER 를 'none' 이나 빈 값으로 주면 설정 파일에 적혀 있어도 기본 모델로 뜬다.
    어댑터 파일은 깃에 없어서 받지 않은 PC도 있으므로, 폴더가 없으면 멈추지 않고 알린 뒤 기본 모델로 뜬다.
    """
    chosen = cfg_value if env_value is None else env_value
    chosen = (chosen or "").strip()
    if chosen.lower() in ("", "none", "base"):
        return ""
    path = os.path.expanduser(chosen)
    if not os.path.isfile(os.path.join(path, "adapter_config.json")):
        print(f"[stt] 어댑터를 찾지 못해 기본 모델로 뜹니다: {path}", flush=True)
        return ""
    return path


def startup():
    import torch
    from transformers import WhisperForConditionalGeneration, WhisperProcessor

    cfg_path = os.environ.get("STT_CONFIG", os.path.join(HERE, "config.yaml"))
    with open(cfg_path, encoding="utf-8") as f:
        S.cfg = yaml.safe_load(f)
    r = S.cfg.get("rag", {})
    S.kiosks = r.get("kiosks", {})
    S.location_cfg = r.get("location") or {}
    S.kb = TransitKB(r.get("kb_dir", "~/data/kb_seoul"), tuple(r.get("weights", (0.8, 0.1, 0.1))),
                     float(r.get("geo_radius_m", 20000)))
    S.kb_meta = json.load(open(os.path.join(S.kb.dir, "meta.json"), encoding="utf-8"))

    model_id = os.environ.get("STT_MODEL") or S.cfg["models"]["finetune_base"]
    # 설정 파일의 어댑터는 설정 파일의 기본 모델에 맞춘 것이라, STT_MODEL 로 다른 모델을 고르면 쓰지 않는다
    cfg_adapter = S.cfg["models"].get("adapter") if model_id == S.cfg["models"]["finetune_base"] else None
    adapter = pick_adapter(os.environ.get("STT_ADAPTER"), cfg_adapter)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32
    processor = WhisperProcessor.from_pretrained(model_id)
    model = WhisperForConditionalGeneration.from_pretrained(model_id, dtype=dtype)
    S.engine = "base"
    if adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, adapter).merge_and_unload()
        S.engine = "finetuned"
    model = model.to(device).eval()
    S.rc = RagCorrector(S.cfg, model, processor, device, kb=S.kb)
    S.model_name = model_id.split("/")[-1] + (f" + {os.path.basename(adapter.rstrip('/'))}" if adapter else "")
    print(f"[stt] model: {S.model_name} ({S.engine}, {device})", flush=True)
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


class LocationReport(BaseModel):
    kiosk_id: str
    x: Optional[float] = Field(None, description="브라우저 위치의 경도 (WGS84). 위치를 못 받았으면 비운다")
    y: Optional[float] = Field(None, description="브라우저 위치의 위도")
    accuracy: Optional[float] = Field(None, description="브라우저가 알려 준 오차 반경(m)")


class ResolveRequest(BaseModel):
    text: str = Field(..., description="/stt 의 corrected_text 또는 터치 입력 장소명")
    kiosk_id: str
    input_mode: str = Field("VOICE", description="VOICE / TOUCH")
    entities: Optional[list[Entity]] = Field(None, description="/stt 응답의 entities 를 그대로 넘기면 재검색을 줄인다")
    # 직전 응답의 ask 를 그대로 돌려보낸다. '종로 몇 가로 가세요?' 뒤의 '삼가요' 같은 짧은 답을 잇는 데 쓴다
    context: Optional[dict] = Field(None, description="직전 /resolve 응답의 ask (되묻기에 대한 짧은 답을 이을 때)")


def display_name(p: dict) -> str:
    if p["poi_type"] == "SUBWAY_STATION":
        line = (p.get("line_info") or "").split("/")[0].strip()
        # 역 이름의 괄호 부제는 화면에서 뺀다: '광화문(세종문화회관)' → '광화문역'
        plain = __import__("re").sub(r"\s*\(.*?\)", "", p["name"]).strip() or p["name"]
        base = plain if plain.endswith("역") else plain + "역"
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


def resolve_origin(kiosk_id: str):
    """요청의 출발지 → (출발지, None) 또는 (None, 오류 코드).
    키오스크가 POST /location 으로 알린 현재 위치가 있으면 그 위치를, 없으면 설정 파일의 고정 위치를 쓴다."""
    live = S.live_origin.get(kiosk_id)
    if live:
        return live, None
    kiosk = S.kiosks.get(kiosk_id)
    if not kiosk:
        return None, "KIOSK_NOT_FOUND"
    return {"source": "KIOSK", "x": kiosk["x"], "y": kiosk["y"], "name": kiosk.get("name", kiosk_id), "snapped": False,
            "accuracy_m": None, "nearest": None}, None


def report_location(kiosk_id: str, x: Optional[float] = None, y: Optional[float] = None,
                    accuracy: Optional[float] = None):
    """키오스크가 알린 브라우저 위치를 반영한다 → (지금부터 쓸 출발지, 고정 위치를 쓰게 된 이유 또는 None, 오류 코드 또는 None).

    쓸 만한 위치면 가장 가까운 정류장·역에 맞춰 기억해 두고, 이후 /stt·/resolve·/pois 가 그 위치를 출발지로 쓴다.
    화면은 돌려받은 출발지 좌표(x, y)를 경로 서버(server/app.py)에 경로를 물을 때 출발지로 쓴다.
    위치가 없거나 쓸 수 없으면(오차가 큼·안내 범위 밖) 기억해 둔 위치를 지우고 설정 파일의 고정 위치로 돌아간다.
    """
    reason = "NO_POSITION"
    if x is not None and y is not None:
        if S.kb is None:
            reason = "KB_NOT_READY"
        else:
            c = S.location_cfg
            got, reason = locate(S.kb, x, y, accuracy, float(c.get("snap_m", SNAP_M)),
                                 float(c.get("max_accuracy_m", MAX_ACCURACY_M)), float(c.get("max_distance_m", MAX_DISTANCE_M)))
            if got:
                S.live_origin[kiosk_id] = got
                return got, None, None
    S.live_origin.pop(kiosk_id, None)
    origin, err = resolve_origin(kiosk_id)
    return origin, reason, err


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
        "route": getattr(S, "route_info", None),  # 이 라우터를 경로 안내와 함께 띄운 앱이 채운다. 단독 실행이면 null
    }
    return ok(data, t0)


@router.post("/stt", summary="음성 → 전사 (RAG 고유명사 보정 포함)")
async def stt(audio: UploadFile = File(..., description="audio/webm 또는 audio/wav, 최대 30초·5MB"),
              kiosk_id: str = Form(...), use_rag: bool = Form(True)):
    t0 = time.time()
    if not S.loaded:
        return fail("MODEL_NOT_READY", "model loading", t0)
    origin, err = resolve_origin(kiosk_id)
    if err:
        return fail(err, f"unknown kiosk_id {kiosk_id}", t0)
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
    res = S.rc.correct(wave, raw_text, conf, (origin["x"], origin["y"]), use_rag=use_rag)
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
    origin, err = resolve_origin(req.kiosk_id)
    if err:
        return fail(err, f"unknown kiosk_id {req.kiosk_id}", t0)
    xy = (origin["x"], origin["y"])
    text = req.text.strip()
    if not text:
        return fail("VALIDATION_ERROR", "text is empty", t0)
    text = apply_context(text, req.context)    # 되묻기에 대한 짧은 답: '삼가요' + {stem: 종로} → '종로3가'

    # 후보: /stt 가 넘긴 entities 재사용 → 없으면 장소 구간 추출(단서·유사도 조건) → 터치 입력은 문장 전체로 검색
    cands = []
    if req.entities:
        for e in req.entities:
            for c in e.candidates:
                p = S.kb.poi(c.poi_id)
                if p:
                    cands.append({**p, "score": c.score, "distance_m": None, "matched": c.matched})
    if not cands:
        # 지식베이스 표기·별칭과 정확히 같은 말이 있으면 그것이 목적지다 ('시청', '고터', 옛 이름 '신천역' 등)
        cands = exact_candidates(text, S.kb, xy)
    # 되묻기 1: 'N가' 가 여럿인 이름의 줄기만 말했다 ('종로 가려는데요') → "종로 몇 가로 가세요?"
    question = None
    if not req.entities and (not cands or cands[0].get("matched") in number_families(S.kb)):
        question = number_question(text, S.kb, xy)
    region = outside_region(text) if not cands and question is None else None
    if region:
        # '대전시청', '부산역'처럼 서울 밖 지역을 말했다. 비슷한 서울 정류장을 억지로 내놓지 않는다
        return fail("OUT_OF_SCOPE", f"outside service area: {region}", t0)
    # 되묻기 2: 종류만 말했다 ('터미널 가려는데요') → "어느 터미널로 가세요?"
    if question is None and not cands:
        question = category_question(text, S.kb, xy)
    if question:
        return ok({"intent": "NAVIGATE", "need_confirm": True, "confirm_text": question["ask"]["text"], "ask": question["ask"],
                   "destination_candidates": [to_candidate(c) for c in question["candidates"]]}, t0)
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
        # 안내 범위(지식베이스) 밖의 실제 역 이름을 말한 경우: '못 알아들음' 이 아니라 '안내할 수 없는 곳' 으로 알린다
        outside = S.rc.find_out_of_area(text) if S.rc is not None else []
        if outside:
            return fail("OUT_OF_SCOPE", f"outside service area: {', '.join(outside)}", t0)
        intent = "NAVIGATE" if req.input_mode == "TOUCH" else classify(text, has_place=False)
        if intent == "NAVIGATE":
            return fail("NO_CANDIDATE", "no destination candidate", t0)
        return ok({"intent": intent, "need_confirm": False, "confirm_text": None, "destination_candidates": []}, t0)

    top = groups[0]
    need = top["score"] < CONFIRM_THRESHOLD or (len(groups) > 1 and top["score"] - groups[1]["score"] < CONFIRM_MARGIN)
    out = [to_candidate(c) for c in groups]
    names = [confirm_name(c["display_name"]) for c in out]
    several = need and len(out) > 1
    # 후보가 여럿이면 하나를 골라 "맞으세요?" 하지 않고 "○○과 △△ 중 어디로 가세요?" 하고 묻는다
    ask = {"type": "CHOICE" if several else "CONFIRM", "text": choice_text(names) if several else confirm_text(names[0])}
    return ok({"intent": "NAVIGATE", "need_confirm": need, "confirm_text": ask["text"], "ask": ask,
               "destination_candidates": out}, t0)


@router.post("/location", summary="키오스크가 현재 위치를 알린다 (가까운 정류장·역에 맞춘 출발지를 돌려준다)")
def location(req: LocationReport):
    """명세 v0.1 에는 없는 프론트 연동용. 화면이 브라우저 위치(GPS)를 알리면 서버가 이 키오스크의 출발지로 기억하고,
    첫 화면에 보여 줄 '지금 계신 곳'을 돌려준다. 좌표가 주소(URL)와 접속 로그에 남지 않도록 본문으로 받는다.
    x·y 를 비웠거나 쓸 수 없는 위치면 설정된 고정 위치로 돌아간다 (source=KIOSK, fallback_reason 에 이유).

    place 는 첫 화면 역명판 띠가 쓰는 장소 정보다 (docs/team-requests.md #1, 형식은 kb/origin.py place_of).
    지금 계신 곳이 역·정류장 가까이(300 m 안)일 때만 주고, 아니면 null 이다. 고정 위치일 때는 name 도 그 역·정류장 이름이다."""
    t0 = time.time()
    origin, reason, err = report_location(req.kiosk_id, req.x, req.y, req.accuracy)
    if err:
        return fail(err, f"unknown kiosk_id {req.kiosk_id}", t0)
    name, place = origin["name"], None
    if S.kb is not None:
        if origin.get("source") == "GPS":
            near = origin.get("nearest") or {}
            place = place_of(S.kb, near) if near.get("distance_m", PLACE_NEAR_M + 1) <= PLACE_NEAR_M else None
        else:
            place = place_of(S.kb, fixed_place(S.kb, S.kiosks.get(req.kiosk_id) or {"x": origin["x"], "y": origin["y"]}))
            if place:
                name = place["name"]
    return ok({**origin, "name": name, "place": place, "fallback_reason": reason, "easy_text": f"지금 계신 곳: {name}"}, t0)


@router.get("/pois", summary="손으로 고르기 화면용 목적지 목록 (출발지에서 가까운 지하철역)")
def pois(kiosk_id: str, limit: int = 12):
    """명세 v0.1 에는 없는 프론트 연동용 조회. 목록 기준(가까운 지하철역)은 임시이며 팀에서 정하면 바꾼다."""
    t0 = time.time()
    if S.kb is None:
        return fail("MODEL_NOT_READY", "kb loading", t0)
    origin, err = resolve_origin(kiosk_id)
    if err:
        return fail(err, f"unknown kiosk_id {kiosk_id}", t0)
    rows = S.kb.nearest((origin["x"], origin["y"]), poi_type="SUBWAY_STATION", limit=max(1, min(limit, 30)))
    return ok({"pois": [to_candidate({**r, "score": None}) for r in rows]}, t0)


# ---------------------------------------------------------------- app
from contextlib import asynccontextmanager  # noqa: E402

from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402


@asynccontextmanager
async def lifespan(_app: FastAPI):
    startup()
    yield


async def on_error(request: Request, exc: Exception):
    return fail("INTERNAL_ERROR", f"{type(exc).__name__}: {exc}", time.time())


def create_app(extra_routers=(), title="Senior Voice STT API",
               description="어르신 음성 → 전사(RAG 보정) → 의도·목적지 후보. 명세 v0.1 의 /stt, /resolve, /health"):
    """앱을 조립한다. 다른 라우터를 함께 띄우려면 extra_routers 로 넘긴다.
    정적 화면 마운트('/')는 모든 경로를 받으므로 반드시 라우터를 다 붙인 뒤 마지막에 한다."""
    new_app = FastAPI(title=title, version=VERSION, lifespan=lifespan, description=description)
    new_app.include_router(router)
    for extra in extra_routers:
        new_app.include_router(extra)
    new_app.add_exception_handler(Exception, on_error)

    # 화면을 다른 주소에서 띄울 때(vite 개발 서버 등)만 필요하다. 같은 출처(아래 정적 서빙, vite proxy)면 쓰이지 않는다
    origins = [o.strip() for o in os.environ.get("STT_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
               if o.strip()]
    new_app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["*"])

    # 키오스크 화면(frontend 의 빌드 결과물)이 있으면 같은 서버에서 함께 내보낸다 → http://localhost:8001 로 접속.
    # 마이크는 같은 출처의 https 또는 localhost 에서만 열린다. 이 방식에서 경로 조회는 다른 출처(경로 서버)로 가므로
    # 화면을 빌드할 때 VITE_ROUTE_API_BASE_URL 에 경로 서버 주소를 적고, 경로 서버가 이 출처를 허용(CORS)해야 한다.
    dist = os.environ.get("FRONTEND_DIST") or os.path.join(os.path.dirname(HERE), "frontend", "dist")
    if os.path.isdir(dist):
        new_app.mount("/", StaticFiles(directory=dist, html=True), name="frontend")
    return new_app


app = create_app()   # STT 서버. 대중교통 경로는 경로 서버(server/app.py)가 따로 맡는다


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8001")))
