// reducer 테스트. 계획서(docs/frontend-plan.md) Phase 2-4 항목:
//   - RESOLVE_NOT_UNDERSTOOD·CONFIRM_NONE_OF_THEM 에서 failCount +1
//   - SWITCH_TO_VOICE·GO_HOME·INACTIVITY_TIMEOUT·LISTEN_CANCEL 에서 failCount 0
//   - DEV_RESET 에서 initialState
//   - 표에 없는 조합은 상태를 바꾸지 않는지
// 추가로 payload 저장, 세션 초기화 범위, 불변성, 대표 시나리오를 확인한다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { STATES } from '../states.js'
import { EVENTS, DEV_EVENTS } from '../events.js'
import { transitions } from '../transitions.js'
import { kioskReducer, initialState } from '../kioskReducer.js'

/** 특정 상태에 있는 테스트용 state 를 만든다 */
const at = (state, extra = {}) => ({ ...initialState, state, ...extra })

/** "한 사용자가 쓰던" 흔적이 가득한 state */
const dirtySession = (state) =>
  at(state, {
    failCount: 2,
    health: { server: true, mic: true, stt: true },
    transcript: '웅얼',
    resolve: { status: 'NOT_UNDERSTOOD' },
    selectedPoi: { id: 'poi-1', name: '서울역' },
    routes: [{ id: 'r1' }],
    qr: { url: 'https://example/r/1' },
    error: '오류',
    lastEvent: EVENTS.FAIL_COUNT_2,
  })

/** 전이 표에서 특정 이벤트를 가진 상태 목록 */
const statesHaving = (event) =>
  Object.entries(transitions)
    .filter(([, row]) => event in row)
    .map(([state]) => state)

let warnSpy
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warnSpy.mockRestore()
})

describe('initialState', () => {
  it('APP_START 행을 표현한다: 시작 상태는 STARTUP_CHECK', () => {
    expect(initialState.state).toBe(STATES.STARTUP_CHECK)
  })

  it('계획서 2-3절의 필드 모양과 같다', () => {
    expect(initialState).toEqual({
      state: STATES.STARTUP_CHECK,
      failCount: 0,
      health: null,
      transcript: '',
      resolve: null,
      selectedPoi: null,
      routes: [],
      qr: null,
      error: null,
      lastEvent: null,
    })
  })
})

describe('failCount 누적 (+1)', () => {
  it('RESOLVING + RESOLVE_NOT_UNDERSTOOD → FAIL_COUNT_CHECK, failCount 0 → 1', () => {
    const next = kioskReducer(at(STATES.RESOLVING), { type: EVENTS.RESOLVE_NOT_UNDERSTOOD })
    expect(next.state).toBe(STATES.FAIL_COUNT_CHECK)
    expect(next.failCount).toBe(1)
  })

  it('CONFIRMING + CONFIRM_NONE_OF_THEM → FAIL_COUNT_CHECK, failCount 1 → 2', () => {
    const next = kioskReducer(at(STATES.CONFIRMING, { failCount: 1 }), { type: EVENTS.CONFIRM_NONE_OF_THEM })
    expect(next.state).toBe(STATES.FAIL_COUNT_CHECK)
    expect(next.failCount).toBe(2)
  })

  it('두 번 실패하면 누적되어 2 가 된다 (중간에 초기화되지 않음)', () => {
    let s = at(STATES.RESOLVING)
    s = kioskReducer(s, { type: EVENTS.RESOLVE_NOT_UNDERSTOOD }) // 1
    s = kioskReducer(s, { type: EVENTS.FAIL_COUNT_1 }) // REASKING
    s = kioskReducer(s, { type: EVENTS.RETRY_SPEECH }) // LISTENING
    s = kioskReducer(s, { type: EVENTS.SPEECH_END, text: '웅얼' }) // RESOLVING
    s = kioskReducer(s, { type: EVENTS.RESOLVE_NOT_UNDERSTOOD }) // 2
    expect(s.failCount).toBe(2)
    expect(s.state).toBe(STATES.FAIL_COUNT_CHECK)
  })

  it('그 밖의 이벤트는 failCount 를 건드리지 않는다', () => {
    const next = kioskReducer(at(STATES.REASKING, { failCount: 1 }), { type: EVENTS.RETRY_SPEECH })
    expect(next.failCount).toBe(1)
  })
})

describe('failCount 초기화 (0)', () => {
  it('MANUAL_SELECT + SWITCH_TO_VOICE → LISTENING, failCount 0', () => {
    const next = kioskReducer(at(STATES.MANUAL_SELECT, { failCount: 2 }), { type: EVENTS.SWITCH_TO_VOICE })
    expect(next.state).toBe(STATES.LISTENING)
    expect(next.failCount).toBe(0)
  })

  it('LISTENING + LISTEN_CANCEL → IDLE, failCount 0', () => {
    const next = kioskReducer(at(STATES.LISTENING, { failCount: 1 }), { type: EVENTS.LISTEN_CANCEL })
    expect(next.state).toBe(STATES.IDLE)
    expect(next.failCount).toBe(0)
  })

  it.each(statesHaving(EVENTS.GO_HOME))('%s + GO_HOME → IDLE, failCount 0', (state) => {
    const next = kioskReducer(at(state, { failCount: 2 }), { type: EVENTS.GO_HOME })
    expect(next.state).toBe(STATES.IDLE)
    expect(next.failCount).toBe(0)
  })

  it.each(statesHaving(EVENTS.INACTIVITY_TIMEOUT))('%s + INACTIVITY_TIMEOUT → IDLE, failCount 0', (state) => {
    const next = kioskReducer(at(state, { failCount: 2 }), { type: EVENTS.INACTIVITY_TIMEOUT })
    expect(next.state).toBe(STATES.IDLE)
    expect(next.failCount).toBe(0)
  })
})

describe('IDLE 복귀 시 세션 초기화', () => {
  it.each([
    [STATES.LISTENING, EVENTS.LISTEN_CANCEL],
    [STATES.MANUAL_SELECT, EVENTS.GO_HOME],
    [STATES.QR_HANDOFF, EVENTS.INACTIVITY_TIMEOUT],
  ])('%s + %s → transcript·resolve·selectedPoi·routes·qr·error 비움, health 는 유지', (state, event) => {
    const before = dirtySession(state)
    const next = kioskReducer(before, { type: event })
    expect(next).toMatchObject({
      state: STATES.IDLE,
      failCount: 0,
      transcript: '',
      resolve: null,
      selectedPoi: null,
      routes: [],
      qr: null,
      error: null,
      lastEvent: event,
    })
    expect(next.health).toEqual(before.health) // 장비 상태는 사용자가 바뀌어도 그대로
  })

  it('SWITCH_TO_VOICE 는 failCount 만 0 으로 하고 나머지 세션 필드는 남긴다', () => {
    const before = dirtySession(STATES.MANUAL_SELECT)
    const next = kioskReducer(before, { type: EVENTS.SWITCH_TO_VOICE })
    expect(next.failCount).toBe(0)
    expect(next.transcript).toBe(before.transcript)
    expect(next.selectedPoi).toEqual(before.selectedPoi)
  })
})

describe('DEV_RESET (개발 도구)', () => {
  it('어느 상태에서든 initialState 로 돌아간다 (health 포함, lastEvent 만 DEV_RESET)', () => {
    const next = kioskReducer(dirtySession(STATES.ROUTE_GUIDE), { type: DEV_EVENTS.DEV_RESET })
    expect(next).toEqual({ ...initialState, lastEvent: DEV_EVENTS.DEV_RESET })
    expect(next.health).toBeNull()
  })

  it('전이 표에 없어도 경고 없이 동작한다', () => {
    kioskReducer(at(STATES.CHECKING), { type: DEV_EVENTS.DEV_RESET })
    expect(warnSpy).not.toHaveBeenCalled()
  })
})

describe('표에 없는 조합', () => {
  it('IDLE + ROUTE_FOUND → 상태 그대로, 같은 객체 반환, console.warn 1회', () => {
    const before = at(STATES.IDLE)
    const next = kioskReducer(before, { type: EVENTS.ROUTE_FOUND, routes: [{ id: 'r1' }] })
    expect(next).toBe(before) // 참조까지 같아야 React 가 리렌더하지 않는다
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0][0]).toContain('IDLE')
    expect(warnSpy.mock.calls[0][0]).toContain('ROUTE_FOUND')
  })

  it('모르는 이벤트 타입도 상태를 바꾸지 않는다', () => {
    const before = at(STATES.IDLE)
    expect(kioskReducer(before, { type: 'NO_SUCH_EVENT' })).toBe(before)
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('14개 상태 × 26개 이벤트 중 표에 없는 324개 조합 모두 상태를 바꾸지 않는다', () => {
    let checked = 0
    for (const state of Object.values(STATES)) {
      for (const event of Object.values(EVENTS)) {
        if (transitions[state]?.[event] !== undefined) continue
        const before = at(state, { failCount: 1 })
        expect(kioskReducer(before, { type: event }), `${state} + ${event}`).toBe(before)
        checked++
      }
    }
    expect(checked).toBe(14 * 26 - 40)
    expect(warnSpy).toHaveBeenCalledTimes(checked)
  })
})

describe('payload 저장', () => {
  it('HEALTH_OK / HEALTH_SERVER_DOWN / MIC_OR_STT_UNAVAILABLE → health', () => {
    const health = { server: true, mic: false, stt: true }
    expect(kioskReducer(at(STATES.STARTUP_CHECK), { type: EVENTS.HEALTH_OK, health })).toMatchObject({
      state: STATES.IDLE,
      health,
    })
    expect(kioskReducer(at(STATES.STARTUP_CHECK), { type: EVENTS.HEALTH_SERVER_DOWN, health })).toMatchObject({
      state: STATES.CHECKING,
      health,
    })
    expect(kioskReducer(at(STATES.STARTUP_CHECK), { type: EVENTS.MIC_OR_STT_UNAVAILABLE, health })).toMatchObject({
      state: STATES.IDLE_REDUCED,
      health,
    })
  })

  it('SPEECH_END({ text }) → transcript', () => {
    const next = kioskReducer(at(STATES.LISTENING), { type: EVENTS.SPEECH_END, text: '서울역' })
    expect(next.state).toBe(STATES.RESOLVING)
    expect(next.transcript).toBe('서울역')
  })

  it('SPEECH_END 에 text 가 없으면 빈 문자열 (10초 무발화)', () => {
    expect(kioskReducer(at(STATES.LISTENING), { type: EVENTS.SPEECH_END }).transcript).toBe('')
  })

  it('RESOLVE_NEED_CONFIRM({ resolve }) → resolve 저장, selectedPoi 는 아직 없음', () => {
    const resolve = { status: 'OK', needConfirm: true, candidates: [{ id: 'a' }, { id: 'b' }] }
    const next = kioskReducer(at(STATES.RESOLVING), { type: EVENTS.RESOLVE_NEED_CONFIRM, resolve })
    expect(next.state).toBe(STATES.CONFIRMING)
    expect(next.resolve).toEqual(resolve)
    expect(next.selectedPoi).toBeNull()
  })

  it('RESOLVE_CONFIRMED({ resolve }) → resolve 저장 + resolve.poi 가 selectedPoi', () => {
    const poi = { id: 'poi-1', name: '서울역' }
    const next = kioskReducer(at(STATES.RESOLVING), {
      type: EVENTS.RESOLVE_CONFIRMED,
      resolve: { status: 'OK', needConfirm: false, poi },
    })
    expect(next.state).toBe(STATES.ROUTING)
    expect(next.selectedPoi).toEqual(poi)
  })

  it('RESOLVE_OUT_OF_SCOPE_OR_ERROR({ error }) / ROUTE_FAILED({ error }) → error', () => {
    expect(
      kioskReducer(at(STATES.RESOLVING), { type: EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR, error: '범위 밖' }),
    ).toMatchObject({ state: STATES.UNAVAILABLE, error: '범위 밖' })
    expect(kioskReducer(at(STATES.ROUTING), { type: EVENTS.ROUTE_FAILED, error: '경로 없음' })).toMatchObject({
      state: STATES.UNAVAILABLE,
      error: '경로 없음',
    })
  })

  it('DESTINATION_CONFIRMED({ poi }) / POI_SELECTED({ poi }) → selectedPoi', () => {
    const poi = { id: 'poi-2', name: '시청' }
    expect(kioskReducer(at(STATES.CONFIRMING), { type: EVENTS.DESTINATION_CONFIRMED, poi })).toMatchObject({
      state: STATES.ROUTING,
      selectedPoi: poi,
    })
    expect(kioskReducer(at(STATES.MANUAL_SELECT), { type: EVENTS.POI_SELECTED, poi })).toMatchObject({
      state: STATES.ROUTING,
      selectedPoi: poi,
    })
  })

  it('ROUTE_FOUND({ routes }) → routes', () => {
    const routes = [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]
    const next = kioskReducer(at(STATES.ROUTING), { type: EVENTS.ROUTE_FOUND, routes })
    expect(next.state).toBe(STATES.ROUTE_GUIDE)
    expect(next.routes).toEqual(routes)
  })

  it('유효한 전이는 lastEvent 에 이벤트 이름을 남긴다', () => {
    expect(kioskReducer(at(STATES.IDLE), { type: EVENTS.MIC_BUTTON_PRESSED }).lastEvent).toBe(
      EVENTS.MIC_BUTTON_PRESSED,
    )
  })
})

// RESOLVING 핸들러(effects/handlers/resolving.js)가 dispatch 하는 payload 모양을 reducer 가 그대로 받는지 고정한다.
// 핸들러는 mock /resolve 응답 객체를 통째로 `resolve` 에 담아 보내고, poi 를 따로 꺼내 보내지 않는다.
describe('payload 저장 — RESOLVING 핸들러 계약', () => {
  const poi = { id: 'poi-seoul', name: '서울역', category: '지하철역' }
  const candidates = [
    { id: 'poi-h1', name: '동국대병원', category: '병원' },
    { id: 'poi-h2', name: '서울병원', category: '병원' },
  ]

  it('RESOLVE_CONFIRMED: /resolve 응답 통째로 → resolve 에 저장되고 resolve.poi 가 selectedPoi', () => {
    const response = { status: 'OK', needConfirm: false, poi }
    const next = kioskReducer(at(STATES.RESOLVING, { transcript: '서울역' }), {
      type: EVENTS.RESOLVE_CONFIRMED,
      resolve: response,
    })
    expect(next.state).toBe(STATES.ROUTING)
    expect(next.resolve).toEqual(response)
    expect(next.selectedPoi).toEqual(poi)
    expect(next.transcript).toBe('서울역') // 들은 말은 그대로 남는다
  })

  it('RESOLVE_CONFIRMED: 최상위 poi 만 보내면 selectedPoi 가 되지 않는다 (resolve.poi 만 읽는다)', () => {
    const next = kioskReducer(at(STATES.RESOLVING), { type: EVENTS.RESOLVE_CONFIRMED, poi })
    expect(next.state).toBe(STATES.ROUTING)
    expect(next.resolve).toBeNull()
    expect(next.selectedPoi).toBeNull()
  })

  it('RESOLVE_NEED_CONFIRM: /resolve 응답 통째로 → resolve 에 candidates 가 남고 selectedPoi 는 비어 있다', () => {
    const response = { status: 'OK', needConfirm: true, candidates }
    const next = kioskReducer(at(STATES.RESOLVING, { transcript: '병원' }), {
      type: EVENTS.RESOLVE_NEED_CONFIRM,
      resolve: response,
    })
    expect(next.state).toBe(STATES.CONFIRMING)
    expect(next.resolve).toEqual(response)
    expect(next.resolve.candidates).toHaveLength(2)
    expect(next.selectedPoi).toBeNull()
    expect(next.transcript).toBe('병원')
  })

  it('RESOLVE_NOT_UNDERSTOOD: payload 없음. transcript·resolve 는 건드리지 않고 failCount 만 +1', () => {
    const before = at(STATES.RESOLVING, { transcript: '웅얼', resolve: null })
    const next = kioskReducer(before, { type: EVENTS.RESOLVE_NOT_UNDERSTOOD })
    expect(next.state).toBe(STATES.FAIL_COUNT_CHECK)
    expect(next.failCount).toBe(1)
    expect(next.transcript).toBe('웅얼')
    expect(next.resolve).toBeNull()
    expect(next.error).toBeNull()
  })

  it('RESOLVE_OUT_OF_SCOPE_OR_ERROR: error 문자열 저장, selectedPoi 는 만들지 않는다', () => {
    const next = kioskReducer(at(STATES.RESOLVING, { transcript: '하와이' }), {
      type: EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR,
      error: 'STT_ERROR',
    })
    expect(next.state).toBe(STATES.UNAVAILABLE)
    expect(next.error).toBe('STT_ERROR')
    expect(next.selectedPoi).toBeNull()
    expect(next.failCount).toBe(0) // 범위 밖·오류는 실패 횟수로 세지 않는다
  })

  it.each([
    [EVENTS.RESOLVE_CONFIRMED, 'resolve'],
    [EVENTS.RESOLVE_NEED_CONFIRM, 'resolve'],
    [EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR, 'error'],
  ])('%s 에 payload 가 빠지면 %s 는 null (undefined 가 state 에 남지 않는다)', (event, field) => {
    const next = kioskReducer(at(STATES.RESOLVING), { type: event })
    expect(next[field]).toBeNull()
    expect(next.selectedPoi).toBeNull()
  })
})

describe('불변성', () => {
  const deepFreeze = (obj) => {
    for (const v of Object.values(obj)) if (v && typeof v === 'object') deepFreeze(v)
    return Object.freeze(obj)
  }

  it('얼린 state 로 40개 전이를 모두 실행해도 예외 없이 새 객체를 반환한다', () => {
    for (const [state, row] of Object.entries(transitions)) {
      for (const event of Object.keys(row)) {
        const before = deepFreeze(dirtySession(state))
        const snapshot = JSON.stringify(before)
        const next = kioskReducer(before, {
          type: event,
          text: 'x',
          poi: { id: 'p' },
          routes: [],
          resolve: { poi: { id: 'q' } },
          health: {},
          error: 'e',
        })
        expect(next, `${state} + ${event}`).not.toBe(before)
        expect(next.state).toBe(row[event])
        expect(JSON.stringify(before)).toBe(snapshot)
      }
    }
  })
})

describe('대표 시나리오 (계획서 검증 방법 2절)', () => {
  const run = (events, start = at(STATES.IDLE)) =>
    events.reduce((s, e) => kioskReducer(s, typeof e === 'string' ? { type: e } : e), start)

  it('정상: IDLE → 마이크 → 서울역 → ROUTING → ROUTE_GUIDE → QR_HANDOFF', () => {
    const s = run([
      EVENTS.MIC_BUTTON_PRESSED,
      { type: EVENTS.SPEECH_END, text: '서울역' },
      { type: EVENTS.RESOLVE_CONFIRMED, resolve: { poi: { id: 'seoul' } } },
      { type: EVENTS.ROUTE_FOUND, routes: [{ id: 'r1' }] },
      EVENTS.SEND_TO_PHONE_PRESSED,
    ])
    expect(s.state).toBe(STATES.QR_HANDOFF)
    expect(s.selectedPoi).toEqual({ id: 'seoul' })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('확인: 병원 → CONFIRMING → 후보 선택 → ROUTING', () => {
    const s = run([
      EVENTS.MIC_BUTTON_PRESSED,
      { type: EVENTS.SPEECH_END, text: '병원' },
      { type: EVENTS.RESOLVE_NEED_CONFIRM, resolve: { candidates: [{ id: 'h1' }, { id: 'h2' }] } },
      { type: EVENTS.DESTINATION_CONFIRMED, poi: { id: 'h2' } },
    ])
    expect(s.state).toBe(STATES.ROUTING)
    expect(s.selectedPoi).toEqual({ id: 'h2' })
  })

  it('실패 1회 → REASKING, 2회 → MANUAL_SELECT (failCount 2)', () => {
    const s = run([
      EVENTS.MIC_BUTTON_PRESSED,
      { type: EVENTS.SPEECH_END, text: '웅얼' },
      EVENTS.RESOLVE_NOT_UNDERSTOOD,
      EVENTS.FAIL_COUNT_1,
      EVENTS.RETRY_SPEECH,
      { type: EVENTS.SPEECH_END, text: '웅얼' },
      EVENTS.RESOLVE_NOT_UNDERSTOOD,
      EVENTS.FAIL_COUNT_2,
    ])
    expect(s.state).toBe(STATES.MANUAL_SELECT)
    expect(s.failCount).toBe(2)
  })

  it('실패 1회 뒤 다시 말하기 → 취소 → IDLE, failCount 0', () => {
    const s = run([
      EVENTS.MIC_BUTTON_PRESSED,
      { type: EVENTS.SPEECH_END, text: '웅얼' },
      EVENTS.RESOLVE_NOT_UNDERSTOOD,
      EVENTS.FAIL_COUNT_1,
      EVENTS.RETRY_SPEECH,
      EVENTS.LISTEN_CANCEL,
    ])
    expect(s.state).toBe(STATES.IDLE)
    expect(s.failCount).toBe(0)
  })

  it('범위 밖: 하와이 → UNAVAILABLE → 손으로 고르기 → MANUAL_SELECT', () => {
    const s = run([
      EVENTS.MIC_BUTTON_PRESSED,
      { type: EVENTS.SPEECH_END, text: '하와이' },
      { type: EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR, error: '범위 밖' },
      EVENTS.MANUAL_SELECT_PRESSED,
    ])
    expect(s.state).toBe(STATES.MANUAL_SELECT)
    expect(s.error).toBe('범위 밖')
  })

  it('시작 점검: 서버 불가 → CHECKING → 재시도 → 정상 → IDLE', () => {
    const s = run([EVENTS.HEALTH_SERVER_DOWN, EVENTS.HEALTH_RETRY_TIMER, EVENTS.HEALTH_OK], initialState)
    expect(s.state).toBe(STATES.IDLE)
  })

  it('축소 운영: 마이크 불가 → IDLE_REDUCED → 재점검 → 정상 → IDLE', () => {
    const s = run([EVENTS.MIC_OR_STT_UNAVAILABLE, EVENTS.RECHECK_TIMER, EVENTS.HEALTH_OK], initialState)
    expect(s.state).toBe(STATES.IDLE)
  })
})
