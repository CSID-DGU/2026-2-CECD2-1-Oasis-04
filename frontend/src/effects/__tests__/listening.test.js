// LISTENING 핸들러 테스트 (계획서 Phase 6-2).
// 이 핸들러는 recorder 를 켜고 끄는 것뿐이다. recorder 가 onSpeechEnd({ text }) 를 부르면 SPEECH_END({ text }) 로 바꾸고,
// cleanup 이 recorder.stop() 으로 이어지는지 확인한다. 타이머 자체는 recorder 의 일이라 devices/__tests__/mockRecorder.test.js 에서 본다.
// 환경: node

import { describe, it, expect, vi } from 'vitest'
import { listeningHandler } from '../handlers/listening.js'
import { STATES } from '../../state/states.js'
import { EVENTS } from '../../state/events.js'
import { at, fakeRecorder } from './helpers.js'

const state = at(STATES.LISTENING)

/** start() 에 넘어온 onSpeechEnd 콜백을 붙잡아 두는 가짜 recorder */
function capturingRecorder() {
  let captured = null
  const recorder = fakeRecorder({
    start: ({ onSpeechEnd }) => {
      captured = onSpeechEnd
    },
  })
  return { recorder, fire: (payload) => captured(payload), captured: () => captured }
}

describe('listeningHandler (recorder 연결)', () => {
  it('진입하면 recorder.start 를 한 번 부르고 onSpeechEnd 콜백을 넘긴다', () => {
    const { recorder, captured } = capturingRecorder()
    const dispatch = vi.fn()

    const cleanup = listeningHandler(state, dispatch, { recorder })

    expect(recorder.start).toHaveBeenCalledTimes(1)
    expect(typeof captured()).toBe('function')
    expect(dispatch).not.toHaveBeenCalled() // 시작만 하고 이벤트는 내지 않는다

    cleanup()
  })

  it('recorder 가 onSpeechEnd({ text }) 를 부르면 SPEECH_END 를 같은 text 로 dispatch 한다', () => {
    const { recorder, fire } = capturingRecorder()
    const dispatch = vi.fn()
    const cleanup = listeningHandler(state, dispatch, { recorder })

    fire({ text: '서울역' })

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.SPEECH_END, text: '서울역' })

    cleanup()
  })

  it('무발화로 빈 텍스트가 오면 SPEECH_END 도 빈 text 로 나간다 (RESOLVING 에서 NOT_UNDERSTOOD 흐름)', () => {
    const { recorder, fire } = capturingRecorder()
    const dispatch = vi.fn()
    const cleanup = listeningHandler(state, dispatch, { recorder })

    fire({ text: '' })

    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.SPEECH_END, text: '' })

    cleanup()
  })

  it('cleanup 하면 recorder.stop 을 한 번 부른다 (타이머·콜백 정리는 recorder 의 책임)', () => {
    const { recorder } = capturingRecorder()
    const dispatch = vi.fn()
    const cleanup = listeningHandler(state, dispatch, { recorder })

    expect(recorder.stop).not.toHaveBeenCalled()
    cleanup()
    expect(recorder.stop).toHaveBeenCalledTimes(1)
  })

  it('핸들러는 recorder.onInput 을 부르지 않는다 (입력 알림은 ListeningScreen 의 책임)', () => {
    const { recorder } = capturingRecorder()
    const cleanup = listeningHandler(state, vi.fn(), { recorder })
    cleanup()
    expect(recorder.onInput).not.toHaveBeenCalled()
  })

  it('StrictMode 순서(실행 → cleanup → 재실행)면 start, stop, start 순으로 불린다', () => {
    const { recorder } = capturingRecorder()
    const dispatch = vi.fn()

    const cleanup1 = listeningHandler(state, dispatch, { recorder })
    cleanup1()
    const cleanup2 = listeningHandler(state, dispatch, { recorder })

    const order = [...recorder.start.mock.invocationCallOrder.map((n) => [n, 'start']), ...recorder.stop.mock.invocationCallOrder.map((n) => [n, 'stop'])]
      .sort((a, b) => a[0] - b[0])
      .map(([, name]) => name)
    expect(order).toEqual(['start', 'stop', 'start'])

    cleanup2()
  })
})
