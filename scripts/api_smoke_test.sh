#!/bin/bash
# STT API 동작 확인: /health, /stt (wav, webm), /resolve
BASE=http://localhost:8000/api/v1
PY=~/senior-voice/.venv/bin/python
T=/tmp/stt_test; mkdir -p "$T"

echo "== wait for server =="
for i in $(seq 1 60); do
  if curl -sf "$BASE/health" >/dev/null 2>&1; then echo "up after ${i}x3s"; break; fi
  sleep 3
done
echo "== /health =="
curl -s "$BASE/health" | "$PY" -m json.tool --no-ensure-ascii

# 테스트 음성: 검증셋에서 선릉역 발화 하나 (16 kHz wav)
WAV=$(grep -m1 "선릉역" ~/data/aihub94/manifests/test.jsonl | "$PY" -c "import sys,json; print(json.loads(sys.stdin.read())['audio'])")
REF=$(grep -m1 "선릉역" ~/data/aihub94/manifests/test.jsonl | "$PY" -c "import sys,json; print(json.loads(sys.stdin.read())['text'])")
echo "== /stt (wav) ref: $REF =="
curl -s -X POST "$BASE/stt" -F "audio=@$WAV;type=audio/wav" -F "kiosk_id=KIOSK_JONGNO_01" | "$PY" -m json.tool --no-ensure-ascii | head -40

echo "== /stt (webm/opus, MediaRecorder 형식) =="
ffmpeg -loglevel error -y -i "$WAV" -c:a libopus -b:a 32k "$T/test.webm"
curl -s -X POST "$BASE/stt" -F "audio=@$T/test.webm;type=audio/webm" -F "kiosk_id=KIOSK_JONGNO_01" | "$PY" -c "import sys,json; d=json.load(sys.stdin); print(json.dumps({k:d['data'].get(k) for k in ('raw_text','corrected_text','rag_applied','audio_duration_ms','stage_latency_ms')} if d['success'] else d, ensure_ascii=False))"

echo "== /stt errors: unknown kiosk / empty =="
curl -s -X POST "$BASE/stt" -F "audio=@$WAV;type=audio/wav" -F "kiosk_id=NOPE" | head -c 300; echo
head -c 100 /dev/zero > "$T/empty.wav"; curl -s -X POST "$BASE/stt" -F "audio=@$T/empty.wav;type=audio/wav" -F "kiosk_id=KIOSK_JONGNO_01" | head -c 300; echo

echo "== /resolve =="
for q in "이거 청량리 가요?" "선능력 가려면 어떻게 가" "응 맞아" "아니 그거 말고" "그만할래" "뭐라고요?" "경동시장" "오늘 날씨 어때"; do
  printf "%-22s -> " "$q"
  curl -s -X POST "$BASE/resolve" -H "Content-Type: application/json" \
    -d "{\"text\": \"$q\", \"kiosk_id\": \"KIOSK_JONGNO_01\"}" | "$PY" -c "
import sys, json
d = json.load(sys.stdin)
if not d['success']:
    print('ERROR', d['error']['code'], '|', d['error']['easy_message']); sys.exit()
x = d['data']
print(x['intent'], '| confirm' if x['need_confirm'] else '| direct', '|', x['confirm_text'], '|', [(c['display_name'], c['score'], c['distance_m']) for c in x['destination_candidates']], '|', d['latency_ms'], 'ms')"
done
echo "== /resolve TOUCH =="
curl -s -X POST "$BASE/resolve" -H "Content-Type: application/json" -d '{"text": "서울대병원", "kiosk_id": "KIOSK_JONGNO_01", "input_mode": "TOUCH"}' | "$PY" -m json.tool --no-ensure-ascii | head -30
echo "== /docs =="
curl -s -o /dev/null -w "docs HTTP %{http_code}\n" http://localhost:8000/docs
curl -s http://localhost:8000/openapi.json | "$PY" -c "import sys,json; d=json.load(sys.stdin); print('openapi paths:', list(d['paths']))"
