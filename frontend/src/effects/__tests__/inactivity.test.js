// @vitest-environment jsdom
//
// 무입력 복귀(inactivity) 공통 핸들러 테스트 (계획서 Phase 6-2, 타이머).
// config.inactivityMs 동안 입력이 없으면 INACTIVITY_TIMEOUT 을 한 번 dispatch 하고, document 의 pointerdown / keydown 이
// 오면 타이머가 처음부터 다시 돌며, cleanup 뒤에는 타이머도 리스너도 남지 않는지 확인한다.
// 환경: jsdom. 이 핸들러만 document 에 리스너를 걸기 때문에 이 파일만 첫 줄 주석으로 jsdom 을 켠다 (나머지는 node).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { inactivityHandler } from '../handlers/inactivity.js'
import { STATES, INACTIVITY_STATES } from '../../state/states.js'
import { EVENTS } from '../../state/events.js'
import { at } from './helpers.js'

const INACTIVITY_MS = 8000
const config = { inactivityMs: INACTIVITY_MS }
const state = at(STATES.CONFIRMING)

/** 사용자 입력 흉내. 핸들러는 이벤트 종류(type)만 보므로 PointerEvent 가 아닌 기본 Event 로 충분하다. */
const touch = () => document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
const pressKey = () => document.dispatchEvent(new Event('keydown', { bubbles: true }))

describe('inactivityHandler (무입력 복귀 타이머)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('document 가 있는 환경에서 돈다 (jsdom 확인)', () => {
    expect(typeof document).toBe('object')
    expect(typeof document.addEventListener).toBe('function')
  })

  it('inactivityMs 직전까지는 dispatch 하지 않는다', () => {
    const dispatch = vi.fn()
    const cleanup = inactivityHandler(state, dispatch, { config })

    vi.advanceTimersByTime(INACTIVITY_MS - 1)
    expect(dispatch).not.toHaveBeenCalled()

    cleanup()
  })

  it('inactivityMs 동안 입력이 없으면 INACTIVITY_TIMEOUT 을 정확히 한 번 dispatch 한다', () => {
    const dispatch = vi.fn()
    const cleanup = inactivityHandler(state, dispatch, { config })

    vi.advanceTimersByTime(INACTIVITY_MS)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.INACTIVITY_TIMEOUT })

    // 만료 뒤에는 반복하지 않는다 (IDLE 로 가면서 cleanup 이 불리는 것이 정상 흐름)
    vi.advanceTimersByTime(INACTIVITY_MS * 2)
    expect(dispatch).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('pointerdown(터치·마우스)이 오면 타이머가 처음부터 다시 돈다', () => {
    const dispatch = vi.fn()
    const cleanup = inactivityHandler(state, dispatch, { config })

    vi.advanceTimersByTime(INACTIVITY_MS - 1) // 만료 1ms 전
    touch() // 리셋
    vi.advanceTimersByTime(INACTIVITY_MS - 1) // 리셋 기준으로 또 1ms 전 → 원래 기준이면 이미 울렸을 시각
    expect(dispatch).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1) // 리셋 기준 만료
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.INACTIVITY_TIMEOUT })

    cleanup()
  })

  it('keydown(키보드)이 와도 타이머가 처음부터 다시 돈다', () => {
    const dispatch = vi.fn()
    const cleanup = inactivityHandler(state, dispatch, { config })

    vi.advanceTimersByTime(INACTIVITY_MS - 1)
    pressKey()
    vi.advanceTimersByTime(INACTIVITY_MS - 1)
    expect(dispatch).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(dispatch).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('입력이 계속 들어오는 동안에는 아무리 오래 지나도 dispatch 하지 않는다', () => {
    const dispatch = vi.fn()
    const cleanup = inactivityHandler(state, dispatch, { config })

    // 만료 직전마다 한 번씩 건드리며 총 10배의 시간을 보낸다
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(INACTIVITY_MS - 1)
      i % 2 === 0 ? touch() : pressKey()
    }
    expect(dispatch).not.toHaveBeenCalled()

    cleanup()
  })

  it('리셋이 여러 번 와도 살아 있는 타이머는 항상 하나뿐이다 (리셋 때 이전 타이머를 지운다)', () => {
    const dispatch = vi.fn()
    const cleanup = inactivityHandler(state, dispatch, { config })

    touch()
    touch()
    pressKey()
    expect(vi.getTimerCount()).toBe(1)

    cleanup()
  })

  it('cleanup 뒤에는 시간이 지나도 dispatch 하지 않고 타이머도 남지 않는다', () => {
    const dispatch = vi.fn()
    const cleanup = inactivityHandler(state, dispatch, { config })

    vi.advanceTimersByTime(INACTIVITY_MS - 1)
    cleanup()
    vi.advanceTimersByTime(INACTIVITY_MS * 3)

    expect(dispatch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cleanup 은 add 한 것과 같은 함수 참조로 pointerdown·keydown 리스너를 모두 remove 한다', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const dispatch = vi.fn()

    const cleanup = inactivityHandler(state, dispatch, { config })
    const added = addSpy.mock.calls.map(([name, fn]) => [name, fn])
    expect(added.map(([name]) => name).sort()).toEqual(['keydown', 'pointerdown'])

    cleanup()
    const removed = removeSpy.mock.calls.map(([name, fn]) => [name, fn])
    expect(removed.map(([name]) => name).sort()).toEqual(['keydown', 'pointerdown'])

    // 같은 이벤트 이름에 대해 add 와 remove 의 함수 참조가 같아야 실제로 떼어진다
    for (const [name, fn] of added) {
      const match = removed.find(([n, f]) => n === name && f === fn)
      expect(match, `${name} 리스너가 같은 참조로 remove 되지 않았다`).toBeDefined()
    }
  })

  it('cleanup 뒤에 입력이 와도 새 타이머를 걸지 않는다 (리스너가 실제로 떨어졌다)', () => {
    const dispatch = vi.fn()
    const cleanup = inactivityHandler(state, dispatch, { config })
    cleanup()

    touch()
    pressKey()
    expect(vi.getTimerCount()).toBe(0)

    vi.advanceTimersByTime(INACTIVITY_MS * 2)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('StrictMode 순서(실행 → cleanup → 재실행)로 두 번 불려도 타이머와 리스너는 한 벌만 남는다', () => {
    const dispatch = vi.fn()
    const cleanup1 = inactivityHandler(state, dispatch, { config })
    cleanup1()
    const cleanup2 = inactivityHandler(state, dispatch, { config })

    expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(INACTIVITY_MS)
    expect(dispatch).toHaveBeenCalledTimes(1) // 두 번이 아니라 한 번

    cleanup2()
  })

  it('무입력 복귀 상태 6곳 어디서 시작해도 같은 동작이다 (공통 핸들러)', () => {
    expect(INACTIVITY_STATES).toHaveLength(6)
    for (const stateName of INACTIVITY_STATES) {
      const dispatch = vi.fn()
      const cleanup = inactivityHandler(at(stateName), dispatch, { config })
      vi.advanceTimersByTime(INACTIVITY_MS)
      expect(dispatch, `${stateName} 에서 INACTIVITY_TIMEOUT 이 나가지 않았다`).toHaveBeenCalledWith({
        type: EVENTS.INACTIVITY_TIMEOUT,
      })
      cleanup()
    }
    expect(vi.getTimerCount()).toBe(0)
  })
})
