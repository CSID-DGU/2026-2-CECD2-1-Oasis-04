// 실제 마이크 구현. navigator.mediaDevices.getUserMedia + MediaRecorder 로 녹음하고,
// AnalyserNode 로 음량을 재서 말이 시작됐는지·끝났는지 판단한다.
// mockRecorder 와 함수 이름·시그니처가 같다 (checkMic / start / onInput / stop). 추가로 takeRecording 이 있다.
//
// 타이머 규칙은 mockRecorder 와 같다 (계획서 2-5절 'LISTENING 책임 분리'):
//   무발화: start() 뒤 config.noSpeechMs 동안 말소리가 한 번도 안 잡히면 onSpeechEnd({ text: '' })
//   무음:   말소리가 잡힌 뒤 config.silenceMs 동안 조용하면 onSpeechEnd({ text: '' })
//   상한:   config.maxRecordMs 가 지나면 말하는 중이어도 끝낸다 (서버가 받는 길이 제한)
// 실제 마이크는 글자를 모르므로 text 는 항상 빈 문자열이다. 녹음은 이 모듈이 잠깐 들고 있다가
// RESOLVING 의 api.stt (real/stt.js) 가 takeRecording() 으로 가져간다.
// → LISTENING 핸들러·reducer 는 mock 때와 똑같이 { text } 만 주고받으므로 바꿀 것이 없다.
//
// 녹음을 넘기는 경우와 버리는 경우:
//   무음·상한으로 끝남, '다 말했어요'(화면이 SPEECH_END → cleanup 이 stop())  → 녹음을 넘긴다
//   무발화로 끝남                                                            → 버린다 (빈 텍스트 → 못 알아들음 흐름)
//   '취소'·'처음으로'(cleanup 이 stop())                                      → 아무도 가져가지 않으므로 잠시 뒤 버려진다
// stop() 은 어느 버튼 때문에 불렸는지 알 수 없어서, 일단 녹음을 마무리해 두고 DISCARD_AFTER_MS 안에 가져가지 않으면 지운다.
// 음성은 메모리에만 있고 어디에도 저장하지 않는다.
//
// StrictMode 대응: start → stop → start 로 불려도 겹치지 않게 start() 가 먼저 stop() 을 부른다.
// getUserMedia 를 기다리는 사이 stop() 이 불리면, 뒤늦게 열린 마이크는 바로 닫는다 (session 비교).

import { config } from '../config.js'

/** 브라우저가 지원하는 첫 번째 형식을 쓴다. 서버는 ffmpeg 로 읽으므로 어느 것이든 받는다 */
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']

const POLL_MS = 50 // 음량을 재는 간격
const CALIBRATION_MS = 300 // 시작 직후 주변 소음 크기를 재는 시간
const MIN_THRESHOLD = 0.015 // 말소리로 보는 최소 음량 (RMS, 0~1)
const MAX_THRESHOLD = 0.08 // 시작하자마자 말해서 소음이 크게 재졌을 때의 상한
const NOISE_MARGIN = 3 // 주변 소음의 몇 배부터 말소리로 볼지
const VOICE_POLLS_TO_START = 2 // 연속 몇 번 넘어야 말소리로 볼지 (딸깍 소리 무시)
const DISCARD_AFTER_MS = 15000 // 가져가지 않은 녹음을 지우는 시간

let session = null // 지금 듣고 있는 세션. 없으면 null
let pendingRecording = null // 끝난 녹음 (Promise<Blob|null>). api.stt 가 가져가면 null
let discardTimer = null

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return ''
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

// STARTUP_CHECK 에서 마이크를 쓸 수 있는지 묻는다. 권한 창이 아직 안 떴다면 여기서 뜬다
// (말하기 버튼을 누른 뒤가 아니라 시작할 때 묻는 편이 낫다). 확인만 하고 바로 닫는다.
export async function checkMic() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    return { available: false }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return { available: true }
  } catch (e) {
    console.warn('[recorder] 마이크를 쓸 수 없음:', e?.name, e?.message)
    return { available: false }
  }
}

// LISTENING 진입 시 호출. 마이크를 열고 녹음과 타이머를 시작한다.
export function start({ onSpeechEnd }) {
  stop()
  discardPending()

  const s = {
    callback: onSpeechEnd,
    stream: null,
    mediaRecorder: null,
    chunks: [],
    audioCtx: null,
    analyser: null,
    buffer: null,
    pollTimer: null,
    noSpeechTimer: null,
    maxTimer: null,
    startedAt: 0,
    noiseSum: 0,
    noiseCount: 0,
    threshold: MIN_THRESHOLD,
    voicePolls: 0,
    speechDetected: false,
    lastVoiceAt: 0,
    levelReadable: false, // 음량을 한 번이라도 읽었는지. 못 읽는 환경이면 무발화 판단을 서버에 맡긴다
  }
  session = s
  open(s)
}

async function open(s) {
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch (e) {
    console.warn('[recorder] 마이크 열기 실패:', e?.name, e?.message)
    if (session === s) finish(s, { notify: true, keep: false }) // 빈 텍스트로 끝낸다 → 못 알아들음 흐름
    return
  }
  if (session !== s) {
    // 기다리는 동안 stop() 이 불렸다 (StrictMode 1차 실행, 바로 취소 등)
    stream.getTracks().forEach((t) => t.stop())
    return
  }
  s.stream = stream

  const mimeType = pickMimeType()
  s.mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  s.mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) s.chunks.push(e.data)
  }
  s.mediaRecorder.start(250)

  try {
    const AudioCtx = window.AudioContext ?? window.webkitAudioContext
    s.audioCtx = new AudioCtx()
    s.analyser = s.audioCtx.createAnalyser()
    s.analyser.fftSize = 1024
    s.audioCtx.createMediaStreamSource(stream).connect(s.analyser)
    s.buffer = new Float32Array(s.analyser.fftSize)
    if (s.audioCtx.state === 'suspended') s.audioCtx.resume().catch(() => {})
  } catch (e) {
    console.warn('[recorder] 음량 측정을 쓸 수 없음 (녹음은 계속):', e?.message)
    s.analyser = null
  }

  s.startedAt = performance.now()
  s.noSpeechTimer = setTimeout(() => {
    s.noSpeechTimer = null
    // 음량을 못 읽는 환경이면 말했는지 알 수 없다. 녹음을 버리지 않고 서버가 판단하게 한다
    finish(s, { notify: true, keep: !s.levelReadable }, '무발화 타이머 만료')
  }, config.noSpeechMs)
  s.maxTimer = setTimeout(() => {
    s.maxTimer = null
    finish(s, { notify: true, keep: true }, '녹음 상한 도달')
  }, config.maxRecordMs)
  if (s.analyser) s.pollTimer = setInterval(() => poll(s), POLL_MS)
}

// POLL_MS 마다 음량(RMS)을 재서 말소리 시작·끝을 판단한다
function poll(s) {
  if (session !== s || !s.analyser || s.audioCtx.state !== 'running') return
  s.levelReadable = true
  s.analyser.getFloatTimeDomainData(s.buffer)
  let sum = 0
  for (let i = 0; i < s.buffer.length; i += 1) sum += s.buffer[i] * s.buffer[i]
  const rms = Math.sqrt(sum / s.buffer.length)
  const now = performance.now()

  // 시작 직후에는 주변 소음 크기를 재서 기준을 정한다 (조용한 방과 정류장의 기준이 달라야 한다)
  if (now - s.startedAt < CALIBRATION_MS) {
    s.noiseSum += rms
    s.noiseCount += 1
    const noise = s.noiseSum / s.noiseCount
    s.threshold = Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, noise * NOISE_MARGIN))
    return
  }

  if (rms >= s.threshold) {
    s.voicePolls += 1
    if (s.voicePolls >= VOICE_POLLS_TO_START) {
      if (!s.speechDetected) {
        s.speechDetected = true
        if (s.noSpeechTimer !== null) {
          clearTimeout(s.noSpeechTimer)
          s.noSpeechTimer = null
        }
      }
      s.lastVoiceAt = now
    }
    return
  }

  s.voicePolls = 0
  if (s.speechDetected && now - s.lastVoiceAt >= config.silenceMs) {
    finish(s, { notify: true, keep: true }, '무음 타이머 만료')
  }
}

// 세션을 끝낸다. 콜백을 먼저 꺼내고 세션을 정리한 뒤 호출한다 (mockRecorder 의 fireSpeechEnd 와 같은 순서).
//   notify: onSpeechEnd 를 부를지 (타이머로 끝났을 때만. stop() 으로 끝났으면 화면이 이미 이벤트를 보냈다)
//   keep:   녹음을 api.stt 에 넘길지
function finish(s, { notify, keep }, reason = '') {
  if (session !== s) return
  session = null

  if (s.noSpeechTimer !== null) clearTimeout(s.noSpeechTimer)
  if (s.maxTimer !== null) clearTimeout(s.maxTimer)
  if (s.pollTimer !== null) clearInterval(s.pollTimer)
  s.noSpeechTimer = null
  s.maxTimer = null
  s.pollTimer = null

  const callback = s.callback
  s.callback = null

  if (keep) {
    pendingRecording = finalizeRecording(s)
    discardTimer = setTimeout(discardPending, DISCARD_AFTER_MS)
  } else {
    releaseDevices(s)
    discardPending()
  }

  if (notify && callback) {
    if (reason) console.log(`[recorder] ${reason} → onSpeechEnd`)
    callback({ text: '' })
  }
}

// MediaRecorder 를 멈추고 조각을 하나의 Blob 으로 합친다. stop 이벤트는 비동기라서 Promise 로 돌려준다
function finalizeRecording(s) {
  return new Promise((resolve) => {
    const recorder = s.mediaRecorder
    const done = () => {
      const type = recorder?.mimeType || s.chunks[0]?.type || 'audio/webm'
      const blob = s.chunks.length > 0 ? new Blob(s.chunks, { type }) : null
      s.chunks = []
      releaseDevices(s)
      resolve(blob)
    }
    if (!recorder || recorder.state === 'inactive') {
      done()
      return
    }
    recorder.addEventListener('stop', done, { once: true })
    try {
      recorder.stop()
    } catch {
      done()
    }
  })
}

// 마이크와 오디오 장치를 놓아준다. 여러 번 불려도 안전하다
function releaseDevices(s) {
  try {
    if (s.mediaRecorder && s.mediaRecorder.state !== 'inactive') s.mediaRecorder.stop()
  } catch {
    // 이미 멈춘 경우
  }
  if (s.stream) s.stream.getTracks().forEach((t) => t.stop())
  if (s.audioCtx && s.audioCtx.state !== 'closed') s.audioCtx.close().catch(() => {})
  s.stream = null
  s.analyser = null
}

function discardPending() {
  if (discardTimer !== null) {
    clearTimeout(discardTimer)
    discardTimer = null
  }
  pendingRecording = null
}

// 실제 마이크에서는 화면 입력이 없다. mockRecorder 와 인터페이스를 맞추기 위한 빈 함수
export function onInput() {}

// LISTENING 을 떠날 때(cleanup) 호출. 여러 번 불려도 안전하다 (idempotent).
// 타이머로 이미 끝난 뒤라면 세션이 없으므로 아무 일도 하지 않는다.
export function stop() {
  const s = session
  if (!s) return
  // 마이크가 아직 안 열렸으면 넘길 녹음이 없다
  finish(s, { notify: false, keep: s.stream !== null })
}

// 방금 끝난 녹음을 한 번만 넘겨준다 (real/stt.js 전용). 없으면 null.
export function takeRecording() {
  const recording = pendingRecording
  discardPending()
  return recording ?? Promise.resolve(null)
}
