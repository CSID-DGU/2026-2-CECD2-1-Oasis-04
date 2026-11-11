// FAIL_COUNT_CHECK 핸들러 테스트 (계획서 Phase 6-2).
// reducer 의 failCount 를 보고 FAIL_COUNT_1(=1) / FAIL_COUNT_2(>=2) 를 내는지, 그리고 dispatch 가 setTimeout(…, 0) 으로
// 한 틱 미뤄져 있어서 즉시 cleanup 하면(StrictMode 1차 실행) 아무것도 나가지 않는지 확인한다.
// 환경: node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { failCountCheckHandler } from '../handlers/failCountCheck.js'
import { STATES } from '../../state/states.js'
import { EVENTS } from '../../state/events.js'
import { at } from './helpers.js'

/** failCount 를 주고 타이머를 모두 돌린 뒤 dispatch 를 돌려준다 */
function run(failCount) {
  const dispatch = vi.fn()
  const cleanup = failCountCheckHandler(at(STATES.FAIL_COUNT_CHECK, { failCount }), dispatch, {})
  vi.runAllTimers()
  cleanup()
  return dispatch
}

describe('failCountCheckHandler (실패 횟수 분기)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('failCount 가 1 이면 FAIL_COUNT_1 을 정확히 한 번 dispatch 한다 (→ REASKING)', () => {
    const dispatch = run(1)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.FAIL_COUNT_1 })
  })

  it('failCount 가 2 면 FAIL_COUNT_2 를 정확히 한 번 dispatch 한다 (→ MANUAL_SELECT)', () => {
    const dispatch = run(2)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.FAIL_COUNT_2 })
  })

  it('failCount 가 3 이상이어도 FAIL_COUNT_2 다 (누적 규칙: 2회 이상은 모두 손으로 고르기)', () => {
    expect(run(3)).toHaveBeenCalledWith({ type: EVENTS.FAIL_COUNT_2 })
    expect(run(7)).toHaveBeenCalledWith({ type: EVENTS.FAIL_COUNT_2 })
  })

  it('failCount 가 0 이면(불변식 위반) 경고를 남기고 FAIL_COUNT_1 로 처리해 상태 머신을 멈추지 않는다', () => {
    const dispatch = run(0)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.FAIL_COUNT_1 })
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it('dispatch 는 동기가 아니라 한 틱 뒤에 나간다 (핸들러 호출 직후에는 아직 0회)', () => {
    const dispatch = vi.fn()
    const cleanup = failCountCheckHandler(at(STATES.FAIL_COUNT_CHECK, { failCount: 1 }), dispatch, {})

    expect(dispatch).not.toHaveBeenCalled() // 아직 타이머가 안 돌았다
    vi.advanceTimersByTime(0)
    expect(dispatch).toHaveBeenCalledTimes(1)

    cleanup()
  })

  it('즉시 cleanup 하면 dispatch 0회다 (StrictMode 1차 실행의 타이머는 cleanup 이 지운다)', () => {
    const dispatch = vi.fn()
    const cleanup = failCountCheckHandler(at(STATES.FAIL_COUNT_CHECK, { failCount: 1 }), dispatch, {})

    cleanup()
    vi.runAllTimers()

    expect(dispatch).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('StrictMode 순서(실행 → cleanup → 재실행)로 두 번 불려도 이벤트는 정확히 한 번만 나간다', () => {
    const dispatch = vi.fn()
    const state = at(STATES.FAIL_COUNT_CHECK, { failCount: 2 })

    const cleanup1 = failCountCheckHandler(state, dispatch, {})
    cleanup1()
    const cleanup2 = failCountCheckHandler(state, dispatch, {})
    vi.runAllTimers()

    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.FAIL_COUNT_2 })

    cleanup2()
  })
})
