// 음성 안내 설정 (2026-11-22): 처음 값, 저장과 읽기, 깨진 값.
import { describe, it, expect } from 'vitest'
import { DEFAULT_SPEECH, RATES, SPEECH_KEY, rateValue, readSpeech, supportText, writeSpeech } from '../speechSettings.js'

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data }
}

describe('speechSettings', () => {
  it('처음에는 켜져 있고 조금 천천히 읽는다', () => {
    expect(readSpeech(fakeStorage())).toEqual({ enabled: true, rate: 'normal', voiceURI: null })
    expect(rateValue('normal')).toBe(0.9)
    expect(RATES.map((r) => r.value)).toEqual([0.75, 0.9, 1])
  })

  it('저장한 값을 다시 읽는다', () => {
    const storage = fakeStorage()
    expect(writeSpeech({ enabled: false, rate: 'slow', voiceURI: 'heami' }, storage)).toBe(true)
    expect(readSpeech(storage)).toEqual({ enabled: false, rate: 'slow', voiceURI: 'heami' })
  })

  it('처음 값으로 되돌리면 저장된 값을 지운다', () => {
    const storage = fakeStorage({ [SPEECH_KEY]: JSON.stringify({ enabled: false, rate: 'slow', voiceURI: null }) })
    expect(writeSpeech({ ...DEFAULT_SPEECH }, storage)).toBe(true)
    expect(storage.data.has(SPEECH_KEY)).toBe(false)
  })

  it('깨진 값이나 모르는 빠르기는 처음 값으로 본다', () => {
    expect(readSpeech(fakeStorage({ [SPEECH_KEY]: '{깨짐' }))).toEqual({ ...DEFAULT_SPEECH })
    expect(readSpeech(fakeStorage({ [SPEECH_KEY]: JSON.stringify({ enabled: 'yes', rate: 'turbo', voiceURI: 3 }) }))).toEqual({ ...DEFAULT_SPEECH })
    expect(rateValue('turbo')).toBe(0.9)
  })

  it('저장소를 쓸 수 없으면 false, 읽기는 처음 값', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {},
    }
    expect(writeSpeech({ enabled: false, rate: 'normal', voiceURI: null }, broken)).toBe(false)
    expect(readSpeech(broken)).toEqual({ ...DEFAULT_SPEECH })
    expect(writeSpeech({ enabled: false, rate: 'normal', voiceURI: null }, null)).toBe(false)
  })

  it('설정 탭의 브라우저 한 줄', () => {
    expect(supportText(false, 0)).toContain('읽지 못합니다')
    expect(supportText(true, 0)).toContain('한국어 목소리가 없습니다')
    expect(supportText(true, 3)).toBe('읽을 수 있음 · 한국어 목소리 3개')
  })
})
