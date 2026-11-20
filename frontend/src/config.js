// 시간 설정값을 한 곳에서 읽는다
// env(VITE_*_MS)가 있으면 그 값을, 없으면 운영 기본값을 쓴다.
// 개발 중에는 .env.development 에서 짧게 줄여서 쓴다.
// effect 핸들러와 recorder는 숫자를 직접 쓰지 않고 반드시 이 객체만 본다.
//
// 개발 모드에서만: 주소 값으로 한 번 덮어쓸 수 있다. 예) http://localhost:5173/?inactivityMs=60000
//   개발 설정(.env.development)의 무입력 8초는 들어가자마자 남은 시간 알림(15초 이하)이 떠서,
//   알림 없는 화면이나 줄어드는 숫자를 확인할 때 .env 를 고치지 않고 이렇게 늘린다. 운영 빌드에서는 무시한다.

const num = (value, fallback) => {
  if (value === undefined || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) {
    console.warn(`[config] 잘못된 시간 설정값 "${value}" → 기본값 ${fallback}ms 사용`)
    return fallback
  }
  return n
}

const urlOverride = (key) => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return undefined
  return new URLSearchParams(window.location.search).get(key) ?? undefined
}

/** 주소 값 → env → 운영 기본값 순서 */
const pick = (key, envValue, fallback) => num(urlOverride(key) ?? envValue, fallback)

export const config = {
  /** CHECKING: 서버 재시도 간격 (운영 30초) */
  healthRetryMs: pick('healthRetryMs', import.meta.env.VITE_HEALTH_RETRY_MS, 30000),
  /** IDLE_REDUCED: 마이크·STT 재점검 간격 (운영 60초) */
  recheckMs: pick('recheckMs', import.meta.env.VITE_RECHECK_MS, 60000),
  /** LISTENING: 진입 후 아무 말도 없을 때 빈 텍스트로 끝내는 시간 (운영 10초) */
  noSpeechMs: pick('noSpeechMs', import.meta.env.VITE_NO_SPEECH_MS, 10000),
  /** LISTENING: 말한 뒤 무음이 이어지면 발화 종료로 보는 시간 (운영 2.5초) */
  silenceMs: pick('silenceMs', import.meta.env.VITE_SILENCE_MS, 2500),
  /** 조작 화면 6곳: 무입력 시 IDLE 로 복귀하는 시간 (운영 60초) */
  inactivityMs: pick('inactivityMs', import.meta.env.VITE_INACTIVITY_MS, 60000),
  /** LISTENING(실제 마이크): 말하는 중이어도 녹음을 끝내는 상한 (운영 25초. 서버는 30초까지 받는다) */
  maxRecordMs: pick('maxRecordMs', import.meta.env.VITE_MAX_RECORD_MS, 25000),
  /** FAIL_COUNT_CHECK: 판단 노드가 다음 이벤트를 내기까지 (운영 0 = 바로. 시연 모드에서만 화면이 보이게 늘린다) */
  choiceDelayMs: pick('choiceDelayMs', import.meta.env.VITE_CHOICE_DELAY_MS, 0),
  /** mock 의 기다림 화면 지연 (RESOLVING 의 stt+resolve 합, ROUTING 의 route). 0 이면 호출마다 300~800ms 무작위 (api/mock/mockDelay.js) */
  mockWaitMs: pick('mockWaitMs', import.meta.env.VITE_MOCK_WAIT_MS, 0),
}

/** 시연 모드 (npm run dev:demo, .env.demo 의 VITE_DEMO=true). 발표자 키(demo/DemoKeys.jsx), DevPanel 처음에 숨김, 시험용 목적지 뺌 */
export const DEMO = import.meta.env.VITE_DEMO === 'true'
