// 시연 흐름 데이터 시험 (demo/demoFlows.js). 실제 앱에서 끝까지 도는 시험은 scripts/screens/demo-flows.js (Playwright).
// 여기서는 reducer 만으로: 각 흐름의 모든 화면에 '이전·처음' 방식(actionsTo)으로 갈 수 있는지,
// '다음' 이벤트가 모두 전이 표에 있어 다음 화면으로 가는지, 표에 없는 전이 경고가 없는지 본다.
// 환경: node

import { describe, it, expect, vi, afterEach } from 'vitest'
import { DEMO_FLOWS, actionsTo, nextActionOf, stepIndexOf } from '../demoFlows.js'
import { kioskReducer, initialState } from '../../state/kioskReducer.js'
import { STATES as S } from '../../state/states.js'

// demo.html 의 FLOWS 화면 순서 (확정 시안). 바뀌면 둘 다 고친다
const DEMO_HTML_FLOWS = [
  ['IDLE', 'LISTENING', 'RESOLVING', 'CONFIRMING', 'ROUTING', 'ROUTE_GUIDE', 'QR_HANDOFF', 'IDLE'],
  ['LISTENING', 'RESOLVING', 'FAIL_COUNT_CHECK', 'REASKING', 'LISTENING'],
  ['ROUTING', 'UNAVAILABLE', 'MANUAL_SELECT'],
  ['IDLE', 'MANUAL_SELECT', 'ROUTING', 'ROUTE_GUIDE'],
  ['IDLE_REDUCED', 'MANUAL_SELECT'],
]

const run = (actions) => actions.reduce(kioskReducer, initialState)

describe('시연 흐름 (demo/demoFlows.js)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('화면 순서가 demo.html 의 FLOWS 와 같다 (22화면)', () => {
    expect(DEMO_FLOWS.map((f) => f.steps.map((s) => s.state))).toEqual(DEMO_HTML_FLOWS)
    expect(DEMO_FLOWS.flatMap((f) => f.steps)).toHaveLength(22)
  })

  DEMO_FLOWS.forEach((flow, f) => {
    it(`${f + 1}. ${flow.name}: 모든 화면에 바로 갈 수 있고, '다음' 이 다음 화면으로 간다`, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      flow.steps.forEach((step, i) => {
        const state = run(actionsTo(flow, i))
        expect(state.state).toBe(step.state)
        const action = nextActionOf(step, state)
        if (i === flow.steps.length - 1) expect(action).toBeNull()
        else expect(kioskReducer(state, action).state).toBe(flow.steps[i + 1].state)
      })
      expect(warn).not.toHaveBeenCalled()
    })
  })

  it('기본 흐름: 명동 후보에서 명동역을 고르고, 첫 경로를 보낸다', () => {
    const state = run(actionsTo(DEMO_FLOWS[0], 6))
    expect(state.state).toBe(S.QR_HANDOFF)
    expect(state.selectedPoi.name).toBe('명동역')
    expect(state.selectedRouteId).toBe(state.routes[0].id)
  })

  it('음성 불가 흐름: 마이크 없음이 health 에 남아 손으로 고르기에서 말로 하기가 숨는다', () => {
    const state = run(actionsTo(DEMO_FLOWS[4], 1))
    expect(state.health.mic).toBe(false)
  })

  it('stepIndexOf: 같은 상태가 두 번이면 지금 자리부터 앞으로 찾는다', () => {
    const basic = DEMO_FLOWS[0]
    expect(stepIndexOf(basic, S.IDLE, 0)).toBe(0)
    expect(stepIndexOf(basic, S.IDLE, 6)).toBe(7)
    expect(stepIndexOf(basic, S.ROUTING, 0)).toBe(4)
    expect(stepIndexOf(basic, S.UNAVAILABLE, 0)).toBe(-1)
  })
})
