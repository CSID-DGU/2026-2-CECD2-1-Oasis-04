// @vitest-environment jsdom
//
// 설정 페이지의 '음성 안내' 탭 테스트 (2026-11-22): 저장된 값이 보이는지, 들어 보기가 고른 값으로 읽는지, 저장하면 브라우저에 적히는지.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import SpeechTab from '../SpeechTab.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { SPEECH_KEY } from '../speechSettings.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data }
}

const HEAMI = { name: 'Microsoft Heami', lang: 'ko-KR', voiceURI: 'heami' }
const GOOGLE = { name: 'Google 한국의', lang: 'ko-KR', voiceURI: 'google-ko' }

function fakeDevice({ supported = true, voices = [HEAMI, GOOGLE] } = {}) {
  return {
    calls: [],
    cancelled: 0,
    supported: () => supported,
    voices: () => voices,
    speak(lines, options) {
      this.calls.push({ lines, options })
      return true
    },
    cancel() {
      this.cancelled += 1
    },
    onVoices: () => () => {},
  }
}

let container
let root

function open({ storage = fakeStorage(), device = fakeDevice(), onDone = vi.fn() } = {}) {
  act(() => root.render(<SpeechTab storage={storage} device={device} onDone={onDone} />))
  return { storage, device, onDone }
}
const radio = (name, value) => container.querySelector(`input[name="${name}"][value="${value}"]`)
const button = (text) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text))
const select = () => container.querySelector('select')

describe('설정 페이지: 음성 안내 탭', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('처음에는 켜기·조금 천천히·자동 목소리가 골라져 있고 목소리 수를 알린다', () => {
    open()
    expect(radio('speech-enabled', 'on').checked).toBe(true)
    expect(radio('speech-rate', 'normal').checked).toBe(true)
    expect(select().value).toBe('')
    expect([...select().options].map((o) => o.textContent)).toEqual(['자동 (브라우저의 한국어 목소리)', 'Microsoft Heami', 'Google 한국의'])
    expect(container.textContent).toContain('읽을 수 있음 · 한국어 목소리 2개')
  })

  it('저장해 둔 값이 골라져 있다', () => {
    open({ storage: fakeStorage({ [SPEECH_KEY]: JSON.stringify({ enabled: false, rate: 'slow', voiceURI: 'heami' }) }) })
    expect(radio('speech-enabled', 'off').checked).toBe(true)
    expect(radio('speech-rate', 'slow').checked).toBe(true)
    expect(select().value).toBe('heami')
  })

  it('들어 보기는 저장하기 전의 선택으로 예시 문장을 읽는다', () => {
    const { device, storage } = open()
    act(() => radio('speech-rate', 'slow').click())
    act(() => button('들어 보기').click())
    expect(device.calls).toHaveLength(1)
    expect(device.calls[0].options).toEqual({ rate: 0.75, voiceURI: null })
    expect(device.calls[0].lines[0]).toContain('안국역에서 내리세요')
    expect(storage.data.size).toBe(0)
  })

  it('끄기를 고르고 저장하면 브라우저에 적고 키오스크 화면으로 돌아간다', () => {
    const { storage, onDone } = open()
    act(() => radio('speech-enabled', 'off').click())
    act(() => button('저장하고').click())
    expect(JSON.parse(storage.data.get(SPEECH_KEY))).toEqual({ enabled: false, rate: 'normal', voiceURI: null })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('브라우저가 읽지 못하면 알리고 들어 보기를 막는다', () => {
    open({ device: fakeDevice({ supported: false, voices: [] }) })
    expect(container.textContent).toContain('이 브라우저는 글을 소리로 읽지 못합니다')
    expect(button('들어 보기').disabled).toBe(true)
  })

  it('탭을 떠나면 읽던 것을 멈춘다', () => {
    const { device } = open()
    act(() => root.render(null))
    expect(device.cancelled).toBe(1)
  })

  it('설정 페이지에 음성 안내 탭이 있다', async () => {
    await act(async () => {
      root.render(<SettingsPage storage={fakeStorage()} probe={async () => ({ reachable: false })} onDone={() => {}} />)
    })
    const tab = [...container.querySelectorAll('[role="tab"]')].find((t) => t.textContent === '음성 안내')
    act(() => tab.click())
    expect(container.querySelector('h2').textContent).toBe('음성 안내 (TTS)')
  })
})
