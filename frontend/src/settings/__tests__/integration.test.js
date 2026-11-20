// STT 서버 연동 여부를 정하는 규칙 테스트 (settings/integration.js). 서버 없이 돈다 (fetch 를 가짜로 바꿔 끼운다).
// 환경: node

import { describe, it, expect, vi, afterEach } from 'vitest'
import { STORAGE_KEY, decide, getIntegration, initIntegration, probeStt, readChoice, shouldNotify, statusText, writeChoice } from '../integration.js'

/** localStorage 흉내 */
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    data,
  }
}

const real = { demo: false, mockBuild: false }

describe('decide: 연동 여부', () => {
  it('자동 + 실제 모드: 서버가 응답하면 켜고, 응답하지 않으면 끈다', () => {
    expect(decide({ ...real, choice: 'auto', reachable: true })).toEqual({ linked: true, reason: 'AUTO_FOUND' })
    expect(decide({ ...real, choice: 'auto', reachable: false })).toEqual({ linked: false, reason: 'AUTO_NOT_FOUND' })
  })
  it('자동 + 연습 모드: 서버가 있어도 끈다', () => {
    expect(decide({ demo: false, mockBuild: true, choice: 'auto', reachable: true })).toEqual({ linked: false, reason: 'AUTO_MOCK_MODE' })
  })
  it('켜기·끄기로 정해 두면 서버가 있든 없든, 어떤 모드로 띄웠든 그대로다', () => {
    expect(decide({ ...real, choice: 'on', reachable: false })).toEqual({ linked: true, reason: 'CHOICE_ON' })
    expect(decide({ demo: false, mockBuild: true, choice: 'on', reachable: false }).linked).toBe(true)
    expect(decide({ ...real, choice: 'off', reachable: true })).toEqual({ linked: false, reason: 'CHOICE_OFF' })
  })
  it('시연 모드는 선택과 상관없이 늘 끈다', () => {
    expect(decide({ demo: true, mockBuild: true, choice: 'on', reachable: true })).toEqual({ linked: false, reason: 'DEMO' })
  })
})

describe('선택 저장', () => {
  it('저장된 것이 없거나 이상한 값이면 자동이다', () => {
    expect(readChoice(fakeStorage())).toBe('auto')
    expect(readChoice(fakeStorage({ [STORAGE_KEY]: 'banana' }))).toBe('auto')
    expect(readChoice(null)).toBe('auto')
  })
  it('켜기·끄기는 저장하고, 자동은 저장된 값을 지운다', () => {
    const storage = fakeStorage()
    expect(writeChoice('off', storage)).toBe(true)
    expect(readChoice(storage)).toBe('off')
    expect(writeChoice('auto', storage)).toBe(true)
    expect(storage.data.has(STORAGE_KEY)).toBe(false)
  })
  it('모르는 값이나 저장소가 없으면 저장하지 못했다고 알린다', () => {
    expect(writeChoice('banana', fakeStorage())).toBe(false)
    expect(writeChoice('on', null)).toBe(false)
    const broken = {
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(writeChoice('on', broken)).toBe(false)
  })
})

describe('initIntegration: 앱을 그리기 전에 한 번', () => {
  it('자동 + 실제 모드에서만 서버를 찾아본다', async () => {
    const found = vi.fn(async () => ({ reachable: true }))
    expect(await initIntegration({ storage: fakeStorage(), probe: found, ...real })).toEqual({ linked: true, reason: 'AUTO_FOUND', choice: 'auto' })
    expect(found).toHaveBeenCalledTimes(1)
    expect(getIntegration().linked).toBe(true)

    const missing = vi.fn(async () => ({ reachable: false }))
    expect((await initIntegration({ storage: fakeStorage(), probe: missing, ...real })).linked).toBe(false)
    expect(getIntegration()).toEqual({ linked: false, reason: 'AUTO_NOT_FOUND', choice: 'auto' })
  })
  it('켜기·끄기로 정해 두었거나 연습·시연 모드면 서버를 찾아보지 않는다', async () => {
    const probe = vi.fn(async () => ({ reachable: true }))
    expect((await initIntegration({ storage: fakeStorage({ [STORAGE_KEY]: 'off' }), probe, ...real })).reason).toBe('CHOICE_OFF')
    expect((await initIntegration({ storage: fakeStorage({ [STORAGE_KEY]: 'on' }), probe, ...real })).reason).toBe('CHOICE_ON')
    expect((await initIntegration({ storage: fakeStorage(), probe, demo: false, mockBuild: true })).reason).toBe('AUTO_MOCK_MODE')
    expect((await initIntegration({ storage: fakeStorage({ [STORAGE_KEY]: 'on' }), probe, demo: true, mockBuild: true })).reason).toBe('DEMO')
    expect(probe).not.toHaveBeenCalled()
  })
})

describe('probeStt: 서버에 닿는지', () => {
  afterEach(() => vi.unstubAllGlobals())
  const respond = (body) => {
    const fetchFn = vi.fn(async () => ({ status: 200, json: async () => body }))
    vi.stubGlobal('fetch', fetchFn)
    return fetchFn
  }

  it('응답하면 모델 이름과 준비 여부를 함께 준다', async () => {
    const fetchFn = respond({
      success: true,
      data: { stt: { loaded: true, engine: 'finetuned', model: 'whisper-large-v3-turbo + senior-voice-lora' }, knowledge_base: { loaded: true } },
    })
    expect(await probeStt()).toEqual({ reachable: true, ready: true, engine: 'finetuned', model: 'whisper-large-v3-turbo + senior-voice-lora' })
    expect(fetchFn.mock.calls[0][0]).toBe('/api/v1/health')
  })
  it('모델을 아직 올리는 중이면 닿기는 하지만 준비 전이다', async () => {
    respond({ success: true, data: { stt: { loaded: false, engine: 'base', model: '' }, knowledge_base: { loaded: false } } })
    expect(await probeStt()).toMatchObject({ reachable: true, ready: false })
  })
  it('서버가 없으면 (연결 실패, 다른 서버의 응답) throw 하지 않고 닿지 않는다고 한다', async () => {
    const refuse = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', refuse)
    expect(await probeStt()).toEqual({ reachable: false, ready: false, engine: null, model: null })
    respond({ detail: 'Not Found' })
    expect((await probeStt()).reachable).toBe(false)
  })
})

describe('화면에 보일 글', () => {
  it('서버 상태 한 줄', () => {
    expect(statusText(null)).toBe('서버를 확인하는 중입니다')
    expect(statusText({ reachable: false })).toBe('서버가 응답하지 않습니다')
    expect(statusText({ reachable: true, ready: true, engine: 'finetuned', model: 'whisper-large-v3-turbo + senior-voice-lora' })).toBe(
      '연결됨 · whisper-large-v3-turbo + senior-voice-lora (학습한 모델)',
    )
    expect(statusText({ reachable: true, ready: true, engine: 'base', model: 'whisper-large-v3-turbo' })).toBe('연결됨 · whisper-large-v3-turbo (기본 모델)')
    expect(statusText({ reachable: true, ready: false, engine: null, model: null })).toBe('연결됨 (모델을 올리는 중)')
  })
  it('연동 꺼짐 알림은 실제 모드로 띄웠는데 꺼져 있을 때만 보인다', () => {
    expect(shouldNotify({ linked: false }, { mockBuild: false, demo: false })).toBe(true)
    expect(shouldNotify({ linked: true }, { mockBuild: false, demo: false })).toBe(false)
    expect(shouldNotify({ linked: false }, { mockBuild: true, demo: false })).toBe(false)
    expect(shouldNotify({ linked: false }, { mockBuild: true, demo: true })).toBe(false)
  })
})
