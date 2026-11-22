// 스피커 장치 (2026-11-22): 가짜 음성 합성을 넣어, 문장을 차례로 넘기는지·멈추는지·목소리를 고르는지 본다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CANCEL_GAP_MS, SPEECH_LANG, createSpeaker, isKorean, pickVoice } from '../speaker.js'

const HEAMI = { name: 'Microsoft Heami - Korean (Korean)', lang: 'ko-KR', voiceURI: 'heami' }
const GOOGLE = { name: 'Google 한국의', lang: 'ko-KR', voiceURI: 'google-ko' }
const SUNHI = { name: 'Microsoft SunHi Online (Natural) - Korean (Korea)', lang: 'ko-KR', voiceURI: 'sunhi' }
const ENGLISH = { name: 'Google US English', lang: 'en-US', voiceURI: 'google-en' }

class FakeUtterance {
  constructor(text) {
    this.text = text
  }
}

function fakeSynth(voices = [ENGLISH, HEAMI, GOOGLE]) {
  const listeners = new Set()
  return {
    spoken: [],
    cancelled: 0,
    getVoices: () => voices,
    speak(u) {
      this.spoken.push(u)
    },
    cancel() {
      this.cancelled += 1
    },
    addEventListener: (type, fn) => type === 'voiceschanged' && listeners.add(fn),
    removeEventListener: (type, fn) => listeners.delete(fn),
    emit: () => listeners.forEach((fn) => fn()),
    listeners,
  }
}

describe('목소리 고르기', () => {
  it('한국어 목소리만 한국어로 본다', () => {
    expect([HEAMI, ENGLISH, { lang: 'ko_KR' }, { lang: 'ko' }, { lang: 'kok-IN' }, null].map(isKorean)).toEqual([true, false, true, true, false, false])
  })
  it('고른 목소리가 목록에 있으면 그것을 쓴다', () => {
    expect(pickVoice([ENGLISH, HEAMI, GOOGLE], 'heami')).toBe(HEAMI)
  })
  it('고르지 않았거나 고른 것이 없으면 자연스러운 온라인 목소리 → 구글 → 그 밖 순서', () => {
    expect(pickVoice([ENGLISH, HEAMI, GOOGLE, SUNHI])).toBe(SUNHI)
    expect(pickVoice([ENGLISH, HEAMI, GOOGLE], 'gone')).toBe(GOOGLE)
    expect(pickVoice([ENGLISH, HEAMI])).toBe(HEAMI)
  })
  it('한국어 목소리가 없으면 null (다른 나라 목소리를 고르지 않는다)', () => {
    expect(pickVoice([ENGLISH])).toBeNull()
    expect(pickVoice([])).toBeNull()
  })
})

describe('createSpeaker', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('문장마다 따로 넘기고 한국어·빠르기·목소리를 적는다', () => {
    const synth = fakeSynth()
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance })
    expect(speaker.speak(['첫 문장.', '', '  둘째 문장.  '], { rate: 0.9 })).toBe(true)
    expect(synth.spoken).toHaveLength(0) // 멈춘 뒤 잠깐 있다가 읽는다
    vi.advanceTimersByTime(CANCEL_GAP_MS)
    expect(synth.spoken.map((u) => u.text)).toEqual(['첫 문장.', '둘째 문장.'])
    expect(synth.spoken.every((u) => u.lang === SPEECH_LANG && u.rate === 0.9 && u.voice === GOOGLE)).toBe(true)
  })

  it('새로 읽으라고 하면 읽던 것을 멈추고, 아직 넘기지 않은 문장은 버린다', () => {
    const synth = fakeSynth()
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance })
    speaker.speak(['앞 화면.'])
    speaker.speak(['새 화면.'])
    vi.advanceTimersByTime(CANCEL_GAP_MS)
    expect(synth.spoken.map((u) => u.text)).toEqual(['새 화면.'])
    expect(synth.cancelled).toBe(2)
  })

  it('cancel 하면 기다리던 문장을 읽지 않는다', () => {
    const synth = fakeSynth()
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance })
    speaker.speak(['읽지 않을 문장.'])
    speaker.cancel()
    vi.advanceTimersByTime(CANCEL_GAP_MS * 2)
    expect(synth.spoken).toHaveLength(0)
  })

  it('고른 목소리를 쓰고, 한국어 목소리가 없으면 목소리를 정하지 않고 한국어라고만 적는다', () => {
    const synth = fakeSynth()
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance })
    speaker.speak(['문장.'], { voiceURI: 'heami' })
    vi.advanceTimersByTime(CANCEL_GAP_MS)
    expect(synth.spoken[0].voice).toBe(HEAMI)

    const bare = fakeSynth([ENGLISH])
    createSpeaker({ synth: bare, Utterance: FakeUtterance }).speak(['문장.'])
    vi.advanceTimersByTime(CANCEL_GAP_MS)
    expect(bare.spoken[0].voice).toBeUndefined()
    expect(bare.spoken[0].lang).toBe(SPEECH_LANG)
  })

  it('문장이 없으면 읽지 않는다', () => {
    const synth = fakeSynth()
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance })
    expect(speaker.speak([])).toBe(false)
    expect(speaker.speak(['', '  '])).toBe(false)
    vi.advanceTimersByTime(CANCEL_GAP_MS)
    expect(synth.spoken).toHaveLength(0)
  })

  it('음성 합성이 없는 곳에서는 아무것도 하지 않는다', () => {
    const speaker = createSpeaker() // 테스트 환경에는 speechSynthesis 가 없다
    expect(speaker.supported()).toBe(false)
    expect(speaker.voices()).toEqual([])
    expect(speaker.speak(['문장.'])).toBe(false)
    expect(() => speaker.cancel()).not.toThrow()
    expect(() => speaker.onVoices(() => {})()).not.toThrow()
  })

  it('한국어 목소리 목록을 주고, 목록이 바뀌면 알린다', () => {
    const synth = fakeSynth()
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance })
    expect(speaker.voices()).toEqual([HEAMI, GOOGLE])
    const listener = vi.fn()
    const stop = speaker.onVoices(listener)
    synth.emit()
    expect(listener).toHaveBeenCalledTimes(1)
    stop()
    expect(synth.listeners.size).toBe(0)
  })
})
