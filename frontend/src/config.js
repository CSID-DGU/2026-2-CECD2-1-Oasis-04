// 시간 설정값을 한 곳에서 읽는다 (Spring의 @ConfigurationProperties 역할).
// env(VITE_*_MS)가 있으면 그 값을, 없으면 운영 기본값을 쓴다.
// 개발 중에는 .env.development 에서 짧게 줄여서 쓴다.
// effect 핸들러와 recorder는 숫자를 직접 쓰지 않고 반드시 이 객체만 본다.

const num = (value, fallback) => {
  if (value === undefined || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) {
    console.warn(`[config] 잘못된 시간 설정값 "${value}" → 기본값 ${fallback}ms 사용`)
    return fallback
  }
  return n
}

export const config = {
  /** CHECKING: 서버 재시도 간격 (운영 30초) */
  healthRetryMs: num(import.meta.env.VITE_HEALTH_RETRY_MS, 30000),
  /** IDLE_REDUCED: 마이크·STT 재점검 간격 (운영 60초) */
  recheckMs: num(import.meta.env.VITE_RECHECK_MS, 60000),
  /** LISTENING: 진입 후 아무 말도 없을 때 빈 텍스트로 끝내는 시간 (운영 10초) */
  noSpeechMs: num(import.meta.env.VITE_NO_SPEECH_MS, 10000),
  /** LISTENING: 말한 뒤 무음이 이어지면 발화 종료로 보는 시간 (운영 2.5초) */
  silenceMs: num(import.meta.env.VITE_SILENCE_MS, 2500),
  /** 조작 화면 6곳: 무입력 시 IDLE 로 복귀하는 시간 (운영 60초) */
  inactivityMs: num(import.meta.env.VITE_INACTIVITY_MS, 60000),
}
