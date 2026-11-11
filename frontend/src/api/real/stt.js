// POST /api/v1/stt 의 실제 구현. 녹음 파일을 보내고 인식된 문장을 { text } 로 돌려준다.
//
// 음성은 어디서 오나:
//   RESOLVING 핸들러는 mock 때와 똑같이 api.stt({ text: state.transcript }) 를 부른다 (핸들러는 바꾸지 않았다).
//   실제 마이크에서는 transcript 가 비어 있고, 녹음은 realRecorder 가 들고 있다가 takeRecording() 으로 넘겨준다.
//   테스트나 다른 호출자가 { audio: Blob } 을 직접 주면 그것을 먼저 쓴다.
//
// 응답 처리:
//   성공               → { text: 고유명사 보정까지 끝난 문장, rawText, confidence, ragApplied }
//   EMPTY_AUDIO        → { text: '' }   (소리가 없거나 너무 짧음. resolve('') 가 NOT_UNDERSTOOD 로 이어 준다)
//   그 밖의 실패       → Error(서버의 쉬운 문장)  → RESOLVE_OUT_OF_SCOPE_OR_ERROR
//   녹음이 없음         → { text: 받은 text 또는 '' }  (10초 무발화. 서버를 부르지 않는다)

import { apiFetch, errorMessageOf, KIOSK_ID } from './http.js'
import { takeRecording } from '../../devices/realRecorder.js'

/** 서버가 형식을 알아보도록 MIME 에 맞는 확장자를 붙인다 (MediaRecorder 기본은 webm) */
function fileNameFor(blob) {
  const type = blob?.type ?? ''
  if (type.includes('wav')) return 'speech.wav'
  if (type.includes('ogg')) return 'speech.ogg'
  if (type.includes('mp4')) return 'speech.m4a'
  return 'speech.webm'
}

export async function stt(input) {
  const audio = input?.audio ?? (await takeRecording())
  if (!audio || audio.size === 0) return { text: input?.text ?? '' }

  const form = new FormData()
  form.append('audio', audio, fileNameFor(audio))
  form.append('kiosk_id', KIOSK_ID)

  const body = await apiFetch('/stt', { method: 'POST', form, timeoutMs: 30000 })
  if (!body.success) {
    if (body.error?.code === 'EMPTY_AUDIO') return { text: '' }
    throw new Error(errorMessageOf(body, 'STT_ERROR'))
  }
  const d = body.data ?? {}
  return {
    text: d.corrected_text ?? '',
    rawText: d.raw_text ?? '',
    confidence: d.confidence ?? null,
    ragApplied: Boolean(d.rag_applied),
  }
}
