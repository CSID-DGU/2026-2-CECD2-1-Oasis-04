// 시연 흐름 다섯 가지 (옮기기 계획 5-3절, 확정 시안 design/mockups/confirmed/demo.html 의 FLOWS).
// 화면 순서(steps 의 state)는 demo.html 과 같아야 한다. scripts/screens/demo-flows.js 가 실제 앱에서 그 순서를 확인한다.
//
// 이 파일은 데이터와 순수 함수뿐이다. 새 상태·전이·이벤트는 없다. 모든 동작은 전이 표에 있는 이벤트를 보내는 것이다.
//   scenario  흐름을 시작할 때 고르는 mock 시나리오 (api/mock/scenario.js). 이벤트가 아니라 mock 동작이다
//   start     처음부터(DEV_RESET) 첫 화면까지 가는 이벤트. 한 번에 보내므로 중간 화면은 그려지지 않는다
//   steps     화면 하나 = { state, next, say }
//             next  발표자가 '다음'(→)을 누르면 보내는 이벤트. 화면 버튼이나 기다림 화면의 effect 가 내는 것과 같다.
//                   함수면 그때의 reducer 상태를 받아 이벤트를 만든다. 마지막 화면은 null (demo.html 처럼 더 가지 않는다)
//             say   LISTENING 에서 "들은 말" 로 칠 정해진 문장 (devices/mockRecorder.js setDemoSpeech)

import { EVENTS as E, DEV_EVENTS } from '../state/events.js'
import { STATES as S } from '../state/states.js'
import { kioskReducer, initialState } from '../state/kioskReducer.js'
import { ERROR_CODES, kioskError } from '../state/errorCodes.js'
import { NO_ROUTE_MESSAGE } from '../effects/handlers/routing.js'
import { SCENARIOS } from '../api/mock/scenario.js'
import { MYEONGDONG } from '../api/mock/data/pois.js'
import { ROUTES } from '../api/mock/data/routes.js'

const MYEONGDONG_STATION = MYEONGDONG[0] // 명동역 (지하철 4호선)

const HEALTH_OK = { type: E.HEALTH_OK, health: { server: true, mic: true, stt: true } }
// micDown 시나리오의 시작 점검 결과와 같은 값 (effects/handlers/startupCheck.js)
const NO_MIC = { type: E.MIC_OR_STT_UNAVAILABLE, health: { server: true, mic: false, stt: true } }

// 기다림 화면의 next 는 그 화면의 effect 가 mock 응답으로 낼 이벤트와 같다. 발표자가 →를 누르면 기다리지 않고 넘긴다
const NEED_CONFIRM_MYEONGDONG = {
  type: E.RESOLVE_NEED_CONFIRM,
  resolve: { status: 'OK', needConfirm: true, candidates: [...MYEONGDONG] },
}
const ROUTE_FOUND = { type: E.ROUTE_FOUND, routes: ROUTES }
const NO_ROUTE = { type: E.ROUTE_FAILED, error: kioskError(ERROR_CODES.NO_ROUTE, NO_ROUTE_MESSAGE) }
const SEND_FIRST_ROUTE = (state) => ({ type: E.SEND_TO_PHONE_PRESSED, routeId: state.routes[0]?.id ?? null })

export const DEMO_FLOWS = Object.freeze([
  {
    name: '기본',
    scenario: SCENARIOS.normal,
    start: [HEALTH_OK],
    steps: [
      { state: S.IDLE, next: { type: E.MIC_BUTTON_PRESSED } },
      { state: S.LISTENING, say: '명동', next: { type: E.SPEECH_END, text: '명동' } },
      { state: S.RESOLVING, next: NEED_CONFIRM_MYEONGDONG },
      { state: S.CONFIRMING, next: { type: E.DESTINATION_CONFIRMED, poi: MYEONGDONG_STATION } },
      { state: S.ROUTING, next: ROUTE_FOUND },
      { state: S.ROUTE_GUIDE, next: SEND_FIRST_ROUTE },
      { state: S.QR_HANDOFF, next: { type: E.GO_HOME } },
      { state: S.IDLE, next: null },
    ],
  },
  {
    name: '다시 말하기',
    scenario: SCENARIOS.normal,
    start: [HEALTH_OK, { type: E.MIC_BUTTON_PRESSED }],
    steps: [
      { state: S.LISTENING, say: '웅얼웅얼', next: { type: E.SPEECH_END, text: '웅얼웅얼' } },
      { state: S.RESOLVING, next: { type: E.RESOLVE_NOT_UNDERSTOOD } },
      { state: S.FAIL_COUNT_CHECK, next: { type: E.FAIL_COUNT_1 } },
      { state: S.REASKING, next: { type: E.RETRY_SPEECH } },
      { state: S.LISTENING, say: '명동', next: null },
    ],
  },
  {
    name: '안내 불가',
    scenario: SCENARIOS.noRoute,
    start: [HEALTH_OK, { type: E.MANUAL_SELECT_PRESSED }, { type: E.POI_SELECTED, poi: MYEONGDONG_STATION }],
    steps: [
      { state: S.ROUTING, next: NO_ROUTE },
      { state: S.UNAVAILABLE, next: { type: E.MANUAL_SELECT_PRESSED } },
      { state: S.MANUAL_SELECT, next: null },
    ],
  },
  {
    name: '손으로 고르기',
    scenario: SCENARIOS.normal,
    start: [HEALTH_OK],
    steps: [
      { state: S.IDLE, next: { type: E.MANUAL_SELECT_PRESSED } },
      { state: S.MANUAL_SELECT, next: { type: E.POI_SELECTED, poi: MYEONGDONG_STATION } },
      { state: S.ROUTING, next: ROUTE_FOUND },
      { state: S.ROUTE_GUIDE, next: null },
    ],
  },
  {
    name: '음성 불가',
    scenario: SCENARIOS.micDown,
    start: [NO_MIC],
    steps: [
      { state: S.IDLE_REDUCED, next: { type: E.MANUAL_SELECT_PRESSED } },
      { state: S.MANUAL_SELECT, next: null },
    ],
  },
])

/** 이 화면에서 '다음' 으로 보낼 이벤트. 마지막 화면이면 null */
export function nextActionOf(step, state) {
  if (!step?.next) return null
  return typeof step.next === 'function' ? step.next(state) : step.next
}

/**
 * 흐름의 index 번째 화면에 바로 가는 이벤트 목록: DEV_RESET → start → 앞 화면들의 next.
 * 한 번에 보내면 React 가 마지막 상태만 그리므로 중간 화면과 그 effect 는 돌지 않는다 ('이전'·'처음'·숫자 키).
 * 함수 next 는 reducer 로 그때까지의 상태를 계산해 넘긴다.
 */
export function actionsTo(flow, index) {
  const actions = [{ type: DEV_EVENTS.DEV_RESET }, ...flow.start]
  let state = actions.reduce(kioskReducer, initialState)
  for (const step of flow.steps.slice(0, index)) {
    const action = nextActionOf(step, state)
    actions.push(action)
    state = kioskReducer(state, action)
  }
  return actions
}

/**
 * 지금 상태가 흐름의 몇 번째 화면인지. 화면을 손으로 눌러 넘어가도 발표자 키가 따라가게 한다.
 * 같은 상태가 두 번 나오면(기본 흐름의 IDLE, 다시 말하기의 LISTENING) 지금 자리부터 앞으로 찾고, 없으면 처음부터 찾는다.
 * 흐름에 없는 상태면 -1
 */
export function stepIndexOf(flow, stateName, from) {
  const at = (i) => flow.steps[i]?.state === stateName
  if (at(from)) return from
  for (let i = from + 1; i < flow.steps.length; i++) if (at(i)) return i
  return flow.steps.findIndex((s) => s.state === stateName)
}
