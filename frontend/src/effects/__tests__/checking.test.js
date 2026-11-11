// CHECKING 핸들러 테스트 (계획서 Phase 6-2, 타이머).
// config.healthRetryMs 가 지나면 HEALTH_RETRY_TIMER 를 정확히 한 번 dispatch 하고, 그 전에는 아무것도 하지 않으며,
// cleanup 하면 타이머가 멈추는지 확인한다. 시간은 vi.useFakeTimers 로 직접 흘린다 (실제로 기다리지 않는다).
// 환경: node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkingHandler } from '../handlers/checking.js'
import { STATES } from '../../state/states.js'
import { EVENTS } from '../../state/events.js'
import { at } from './helpers.js'

const HEALTH_RETRY_MS = 3000
const config = { healthRetryMs: HEALTH_RETRY_MS }
const state = at(STATES.CHECKING)

describe('checkingHandler (서버 재시도 타이머)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('healthRetryMs 직전까지는 dispatch 하지 않는다', () => {
    const dispatch = vi.fn()
    const cleanup = checkingHandler(state, dispatch, { config })

    vi.advanceTimersByTime(HEALTH_RETRY_MS - 1)
    expect(dispatch).not.toHaveBeenCalled()

    cleanup()
  })

  it('healthRetryMs 가 지나면 HEALTH_RETRY_TIMER 를 정확히 한 번 dispatch 한다', () => {
    const dispatch = vi.fn()
    const cleanup = checkingHandler(state, dispatch, { config })

    vi.advanceTimersByTime(HEALTH_RETRY_MS)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.HEALTH_RETRY_TIMER })

    // 한 번 울린 뒤로는 시간이 더 지나도 반복하지 않는다 (반복은 STARTUP_CHECK → CHECKING 재진입이 맡는다)
    vi.advanceTimersByTime(HEALTH_RETRY_MS * 3)
    expect(dispatch).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('cleanup 뒤에는 시간이 지나도 dispatch 하지 않는다 (StrictMode 1차 실행·상태 이탈 대응)', () => {
    const dispatch = vi.fn()
    const cleanup = checkingHandler(state, dispatch, { config })

    vi.advanceTimersByTime(HEALTH_RETRY_MS - 1)
    cleanup()
    vi.advanceTimersByTime(HEALTH_RETRY_MS * 2)

    expect(dispatch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0) // 남아 있는 타이머가 없다
  })

  it('config 의 값을 그대로 쓴다 (숫자를 핸들러에 직접 쓰지 않는다)', () => {
    const dispatch = vi.fn()
    const cleanup = checkingHandler(state, dispatch, { config: { healthRetryMs: 500 } })

    vi.advanceTimersByTime(499)
    expect(dispatch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(dispatch).toHaveBeenCalledTimes(1)

    cleanup()
  })
})
