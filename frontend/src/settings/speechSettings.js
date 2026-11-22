// 음성 안내(TTS) 설정. 설정 페이지의 '음성 안내' 탭(SpeechTab.jsx)에서 바꾸고 브라우저에 저장한다.
//
//   enabled   읽어 줄지. 처음에는 켜 둔다 (계획서 5.3절 "모든 안내 문구를 화면에 크게 쓰고 동시에 읽어 준다")
//   rate      빠르기: 'slow' | 'normal' | 'fast'. 처음 값 'normal' 은 브라우저 보통 빠르기의 0.9배다 (어르신이 듣기 편하게 조금 느리게)
//   voiceURI  고른 목소리. null 이면 브라우저의 한국어 목소리 중에서 고른다 (devices/speaker.js 의 pickVoice)
//
// 읽을 때마다 이 값을 읽으므로 (effects/voiceGuide.js) 저장하면 다음 문장부터 바로 쓰인다.

export const SPEECH_KEY = 'oasis.speech'

/** 빠르기 선택지. value 는 브라우저 음성 합성의 rate (1 이 보통) */
export const RATES = Object.freeze([
  { id: 'slow', value: 0.75, label: '천천히' },
  { id: 'normal', value: 0.9, label: '조금 천천히' },
  { id: 'fast', value: 1, label: '보통' },
])

export const DEFAULT_SPEECH = Object.freeze({ enabled: true, rate: 'normal', voiceURI: null })

/** 설정 탭의 '들어 보기' 가 읽는 예시 문장 */
export const SAMPLE_LINES = Object.freeze(['종로3가역에서 3호선을 타고, 두 번째 역인 안국역에서 내리세요.', '1번 출구로 나가세요.'])

/** 설정 탭 위쪽의 "브라우저" 한 줄: 읽을 수 있는지와 한국어 목소리 수 */
export function supportText(supported, voiceCount) {
  if (!supported) return '이 브라우저는 글을 소리로 읽지 못합니다'
  if (voiceCount === 0) return '한국어 목소리가 없습니다. 기기 설정에서 한국어 음성을 추가해 주세요'
  return `읽을 수 있음 · 한국어 목소리 ${voiceCount}개`
}

/** 빠르기 이름 → rate 숫자. 모르는 이름이면 처음 값 */
export function rateValue(id) {
  return (RATES.find((r) => r.id === id) ?? RATES.find((r) => r.id === DEFAULT_SPEECH.rate)).value
}

const defaultStorage = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null // 저장소를 막아 둔 브라우저
  }
}

/** 저장된 값. 없거나 읽을 수 없으면 처음 값. 빠진 항목도 처음 값으로 채운다 */
export function readSpeech(storage = defaultStorage()) {
  try {
    const saved = JSON.parse(storage?.getItem(SPEECH_KEY) ?? 'null')
    if (saved && typeof saved === 'object') {
      return {
        enabled: typeof saved.enabled === 'boolean' ? saved.enabled : DEFAULT_SPEECH.enabled,
        rate: RATES.some((r) => r.id === saved.rate) ? saved.rate : DEFAULT_SPEECH.rate,
        voiceURI: typeof saved.voiceURI === 'string' && saved.voiceURI ? saved.voiceURI : null,
      }
    }
  } catch {
    // 깨진 값은 없는 것으로 본다
  }
  return { ...DEFAULT_SPEECH }
}

/** 저장한다. 처음 값과 같으면 저장된 값을 지운다. 저장하지 못하면 false */
export function writeSpeech(value, storage = defaultStorage()) {
  try {
    const next = {
      enabled: Boolean(value?.enabled),
      rate: RATES.some((r) => r.id === value?.rate) ? value.rate : DEFAULT_SPEECH.rate,
      voiceURI: value?.voiceURI || null,
    }
    const same = next.enabled === DEFAULT_SPEECH.enabled && next.rate === DEFAULT_SPEECH.rate && next.voiceURI === DEFAULT_SPEECH.voiceURI
    if (same) storage?.removeItem(SPEECH_KEY)
    else storage?.setItem(SPEECH_KEY, JSON.stringify(next))
    return Boolean(storage)
  } catch {
    return false
  }
}
