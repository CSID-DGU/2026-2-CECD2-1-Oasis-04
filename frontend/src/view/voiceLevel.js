// 음량 값 → 듣는 중 막대 길이 (LISTENING, 디자인 문서 3-5절·10-1절, 시안 listening-final.html 의 막대 스크립트, 옮기기 계획 12단계).
// 화면(React) 밖의 순수 함수만 둔다. VoiceMeter 가 requestAnimationFrame 안에서 부른다.
//
// 흐름: 녹음기 음량(RMS, 0~1) → rmsToLevel(잡음 무시 + 최대값) → followLevel(빨리 올라가고 천천히 내려옴) → barAmount(막대마다)

// ── 음량 → 0~1 ──
export const NOISE_GATE = 0.02 // 이보다 작은 RMS 는 주변 잡음으로 보고 0 (realRecorder 의 말소리 기준 MIN_THRESHOLD 0.015 보다 조금 위)
export const FULL_RMS = 0.2 // 이 RMS 이상이면 가장 긴 막대(1). 더 커도 1 에서 멈춘다 (최대값)
const CURVE = 0.6 // 작은 목소리도 눈에 띄게 (1 보다 작으면 작은 값을 키운다)

/** RMS(0~1) → 막대 음량(0~1). 잘못된 값(null, NaN)은 0 */
export function rmsToLevel(rms) {
  if (!Number.isFinite(rms) || rms <= NOISE_GATE) return 0
  const x = Math.min(1, (rms - NOISE_GATE) / (FULL_RMS - NOISE_GATE))
  return x ** CURVE
}

// ── 부드럽게 ──
export const RISE_MS = 60 // 올라갈 때 시간 상수 (말이 시작되면 바로 보이게)
export const FALL_MS = 450 // 내려올 때 시간 상수 (말 사이가 깜빡이지 않게. 깜빡임 한도 1초 3번, 3-5절)

/** 지난 값 prev 에서 목표 target 으로 dtMs 동안 따라간다. 올라갈 때는 빠르고 내려갈 때는 느리다 */
export function followLevel(prev, target, dtMs) {
  const dt = Math.max(0, Math.min(dtMs, 250)) // 탭이 숨었다 돌아온 긴 간격은 잘라 한 번에 튀지 않게
  const tau = target > prev ? RISE_MS : FALL_MS
  const next = prev + (target - prev) * (1 - Math.exp(-dt / tau))
  return Math.min(1, Math.max(0, next))
}

// ── 막대 모양 (시안 그대로) ──
export const STILL_AT = 0.6 // 멈춘 그림의 시각(초). 시안 스크린샷 ?freeze=0.6 과 같다

/** 시안의 가짜 음량 (0~1): 말 한 마디(약 2.6초)마다 커졌다 잦아들고 그 안에서 출렁인다 (시안 voice()) */
export function fakeVoice(t) {
  const phrase = Math.max(0, Math.sin((Math.PI * 2 * t) / 2.6)) ** 0.55
  return phrase * (0.8 + 0.2 * Math.sin(Math.PI * 2 * 0.9 * t - 1.8))
}

/** 막대 하나의 길이 비율(0.06~1). side 는 위에서부터 몇 번째인지(좌우 같은 모양), t 는 초 */
export function barAmount(level, side, t) {
  const wobble = 0.6 + 0.4 * Math.sin(side * 1.9 + t * 5.3) * Math.sin(side * 0.7 - t * 3.1)
  return 0.06 + 0.94 * level * wobble // 조용할 때도 점이 조금 길쭉하게 남는다
}
