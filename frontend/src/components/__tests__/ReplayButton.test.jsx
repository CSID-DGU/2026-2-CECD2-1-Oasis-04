// @vitest-environment jsdom
//
// '다시 듣기' 버튼과 useSay 훅 (2026-11-22): 읽을 문장이 있을 때만 버튼이 보이고, 누르면 다시 읽고, 화면을 떠나면 멈춘다.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ReplayButton from '../ReplayButton.jsx'
import { useSay } from '../../effects/useSay.js'
import { createVoiceGuide } from '../../effects/voiceGuide.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function fakeSpeaker() {
  return {
    calls: [],
    cancelled: 0,
    supported: () => true,
    speak(lines) {
      this.calls.push(lines)
      return true
    },
    cancel() {
      this.cancelled += 1
    },
  }
}

function Screen({ lines, guide }) {
  useSay(lines, guide)
  return <ReplayButton guide={guide} />
}

let container
let root
let speaker
let guide

describe('ReplayButton 과 useSay', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    speaker = fakeSpeaker()
    guide = createVoiceGuide({ speaker, read: () => ({ enabled: true, rate: 'normal', voiceURI: null }) })
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('읽을 문장이 없으면 버튼이 없다', () => {
    act(() => root.render(<ReplayButton guide={guide} />))
    expect(container.querySelector('button')).toBeNull()
  })

  it('화면이 열리면 읽고 버튼이 보인다. 누르면 같은 문장을 다시 읽는다', () => {
    act(() => root.render(<Screen lines={['안국역, 맞나요?']} guide={guide} />))
    expect(speaker.calls).toEqual([['안국역, 맞나요?']])
    const button = container.querySelector('button.replay-button')
    expect(button.textContent).toBe('다시 듣기')
    act(() => button.click())
    expect(speaker.calls).toEqual([['안국역, 맞나요?'], ['안국역, 맞나요?']])
  })

  it('같은 문장으로 다시 그려져도 다시 읽지 않고, 문장이 바뀌면 새로 읽는다', () => {
    act(() => root.render(<Screen lines={['첫째 경로.']} guide={guide} />))
    act(() => root.render(<Screen lines={['첫째 경로.']} guide={guide} />))
    expect(speaker.calls).toHaveLength(1)
    act(() => root.render(<Screen lines={['둘째 경로.']} guide={guide} />))
    expect(speaker.calls).toEqual([['첫째 경로.'], ['둘째 경로.']])
  })

  it('화면을 떠나면 멈추고 버튼이 사라진다', () => {
    act(() => root.render(<Screen lines={['문장.']} guide={guide} />))
    act(() => root.render(<ReplayButton guide={guide} />))
    expect(speaker.cancelled).toBeGreaterThanOrEqual(1)
    expect(guide.canReplay()).toBe(false)
    expect(container.querySelector('button')).toBeNull()
  })

  it('읽을 문장이 없는 화면은 아무것도 하지 않는다', () => {
    act(() => root.render(<Screen lines={[]} guide={guide} />))
    expect(speaker.calls).toHaveLength(0)
    expect(container.querySelector('button')).toBeNull()
  })
})
