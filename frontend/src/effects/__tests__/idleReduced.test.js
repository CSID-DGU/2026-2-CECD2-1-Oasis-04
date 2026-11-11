// IDLE_REDUCED 핸들러 테스트 (계획서 Phase 6-2, 타이머).
// config.recheckMs 가 지나면 RECHECK_TIMER 를 정확히 한 번 dispatch 하고, 그 전에는 아무것도 하지 않으며,
// cleanup 하면 타이머가 멈추는지 확인한다. 시간은 vi.useFakeTimers 로 직접 흘린다.
// 환경: node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { idleReducedHandler } from '../handlers/idleReduced.js'
import { STATES } from '../../state/states.js'
import { EVENTS } from '../../state/events.js'
import { at } from './helpers.js'

const RECHECK_MS = 5000
const config = { recheckMs: RECHECK_MS }
const state = at(STATES.IDLE_REDUCED)

describe('idleReducedHandler (마이크·STT 재점검 타이머)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('recheckMs 직전까지는 dispatch 하지 않는다', () => {
    const dispatch = vi.fn()
    const cleanup = idleReducedHandler(state, dispatch, { config })

    vi.advanceTimersByTime(RECHECK_MS - 1)
    expect(dispatch).not.toHaveBeenCalled()

    cleanup()
  })

  it('recheckMs 가 지나면 RECHECK_TIMER 를 정확히 한 번 dispatch 한다', () => {
    const dispatch = vi.fn()
    const cleanup = idleReducedHandler(state, dispatch, { config })

    vi.advanceTimersByTime(RECHECK_MS)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.RECHECK_TIMER })

    vi.advanceTimersByTime(RECHECK_MS * 3)
    expect(dispatch).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('cleanup 뒤에는 시간이 지나도 dispatch 하지 않는다 (손으로 고르기로 떠난 경우·StrictMode 1차 실행)', () => {
    const dispatch = vi.fn()
    const cleanup = idleReducedHandler(state, dispatch, { config })

    vi.advanceTimersByTime(RECHECK_MS - 1)
    cleanup()
    vi.advanceTimersByTime(RECHECK_MS * 2)

    expect(dispatch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
