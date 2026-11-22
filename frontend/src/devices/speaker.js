// 브라우저 장치(스피커)를 쓰는 유일한 입구. 글을 소리로 읽는다 (TTS).
// 브라우저의 음성 합성(Web Speech API 의 speechSynthesis)을 쓴다. 프로젝트 계획서 5.4절과 API 명세서 1.1절이 정한 방식이다.
// 서버를 거치지 않고 기기에 깔린 목소리로 읽으므로 STT 서버가 없는 PC 에서도 된다.
//
// 마이크(recorder.js)와 달리 mock/real 을 나누지 않는다. 음성 합성이 없는 곳(테스트, 오래된 브라우저)에서는 아무것도 하지 않는다.
// 무엇을 언제 읽을지는 여기서 정하지 않는다 (effects/voiceGuide.js, view/speechText.js).
//
// 브라우저에서 알아 둘 것
//   - 크롬은 화면을 한 번도 누르지 않은 상태에서는 소리를 내지 않는다. 키오스크는 버튼을 누른 뒤에만 읽으므로 걸리지 않는다
//   - 크롬의 온라인 목소리는 한 번에 15초쯤 넘게 읽으면 끊긴다. 그래서 문장마다 따로 넘긴다
//   - 멈춘 직후 바로 읽으라고 하면 첫 문장이 빠지는 일이 있어, 멈춘 뒤 잠깐(CANCEL_GAP_MS) 있다가 읽는다
//   - 목소리 목록은 페이지가 열린 뒤 조금 있다가 채워진다 (onVoices 로 알린다)

export const SPEECH_LANG = 'ko-KR'
export const CANCEL_GAP_MS = 80

/** 한국어 목소리인가. lang 이 'ko-KR', 'ko_KR', 'ko' 로 온다 */
export function isKorean(voice) {
  return /^ko([-_]|$)/i.test(voice?.lang ?? '')
}

// 고른 목소리가 없을 때의 순서: 엣지의 자연스러운 온라인 목소리 → 크롬의 구글 목소리 → 그 밖 (기기에 깔린 목소리)
const rank = (voice) => (/natural/i.test(voice.name) ? 0 : /google/i.test(voice.name) ? 1 : 2)

/** 읽을 목소리를 고른다. 고른 것(voiceURI)이 목록에 있으면 그것, 없으면 한국어 목소리 중 위 순서로. 한국어 목소리가 없으면 null */
export function pickVoice(voices, voiceURI = null) {
  const korean = (voices ?? []).filter(isKorean)
  return korean.find((v) => voiceURI && v.voiceURI === voiceURI) ?? [...korean].sort((a, b) => rank(a) - rank(b))[0] ?? null
}

/**
 * 스피커를 만든다. 테스트에서는 가짜 synth·Utterance 를 넣는다.
 * synth 를 주지 않으면 쓸 때마다 브라우저의 speechSynthesis 를 본다.
 */
export function createSpeaker({ synth = null, Utterance = null, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const synthOf = () => synth ?? globalThis.speechSynthesis ?? null
  const utteranceOf = () => Utterance ?? globalThis.SpeechSynthesisUtterance ?? null
  let timer = null
  let queued = [] // 읽는 동안 Utterance 가 메모리에서 치워지지 않게 잡아 둔다 (크롬에서 중간에 끊기는 것을 막는다)

  /** 이 브라우저에서 읽을 수 있는가 */
  const supported = () => Boolean(synthOf() && utteranceOf())

  /** 한국어 목소리 목록. 아직 채워지지 않았으면 빈 목록 */
  const voices = () => (supported() ? (synthOf().getVoices?.() ?? []).filter(isKorean) : [])

  /** 읽던 것을 멈추고 기다리던 문장도 버린다 */
  function cancel() {
    if (timer !== null) clearTimer(timer)
    timer = null
    queued = []
    if (supported()) synthOf().cancel()
  }

  /**
   * 문장들을 차례로 읽는다. 읽던 것이 있으면 멈추고 새로 읽는다.
   * @param {string[]} lines 문장 목록 (빈 것은 건너뛴다)
   * @param {{ rate?: number, voiceURI?: string|null }} options rate 1 이 보통 빠르기
   * @returns {boolean} 읽기를 시작했으면 true (읽을 수 없거나 문장이 없으면 false)
   */
  function speak(lines, { rate = 1, voiceURI = null } = {}) {
    cancel()
    const texts = (lines ?? []).map((t) => String(t ?? '').trim()).filter(Boolean)
    if (!supported() || texts.length === 0) return false
    timer = setTimer(() => {
      timer = null
      const Speech = utteranceOf()
      const voice = pickVoice(synthOf().getVoices?.() ?? [], voiceURI)
      queued = texts.map((text) => {
        const u = new Speech(text)
        u.lang = SPEECH_LANG
        u.rate = rate
        if (voice) u.voice = voice
        return u
      })
      for (const u of queued) synthOf().speak(u)
    }, CANCEL_GAP_MS)
    return true
  }

  /** 목소리 목록이 채워지거나 바뀌면 부른다. 돌려주는 함수를 부르면 그만 듣는다 */
  function onVoices(listener) {
    const target = synthOf()
    if (!target?.addEventListener) return () => {}
    target.addEventListener('voiceschanged', listener)
    return () => target.removeEventListener('voiceschanged', listener)
  }

  return { supported, voices, speak, cancel, onVoices }
}

export const speaker = createSpeaker()
