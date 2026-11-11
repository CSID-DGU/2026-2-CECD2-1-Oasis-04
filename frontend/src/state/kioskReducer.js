// 상태 머신의 실행부. 하는 일은 세 가지뿐이다.
//   (1) transitions 로 다음 상태를 찾는다
//   (2) 이벤트에 딸려 온 payload 를 필드에 저장한다
//   (3) failCount 를 올리거나 0 으로 만든다
// API 호출·타이머는 절대 여기 두지 않는다 (effects/ 담당).
// Spring 으로 치면 외부 HTTP 를 직접 부르지 않는 순수 도메인 서비스다.

import { STATES } from './states.js'
import { EVENTS, DEV_EVENTS } from './events.js'
import { nextStateOf } from './transitions.js'

export const initialState = Object.freeze({
  state: STATES.STARTUP_CHECK, // [*] → STARTUP_CHECK (APP_START) 행을 여기서 표현한다
  failCount: 0, // 누적 실패 횟수. 1회 → REASKING, 2회 이상 → MANUAL_SELECT
  health: null, // { server: bool, mic: bool, stt: bool }
  transcript: '', // STT 결과 텍스트
  resolve: null, // /resolve 응답 { status, needConfirm, poi, candidates }
  selectedPoi: null, // 확정된 목적지 { id, name, category }
  routes: [], // /route 응답 경로 최대 3개
  qr: null, // QR 데이터(URL 등). 생성 주체(프론트/서버)가 미정이라 아직 쓰는 이벤트가 없다
  error: null, // 마지막 오류 메시지 (UNAVAILABLE 화면 표시용)
  lastEvent: null, // 개발자 패널 표시용
})

/** IDLE 로 돌아갈 때 비우는 "한 사용자분의 세션" 필드. health 는 장비 상태라 남긴다. */
const SESSION_RESET = Object.freeze({
  failCount: 0,
  transcript: '',
  resolve: null,
  selectedPoi: null,
  routes: [],
  qr: null,
  error: null,
})

/** IDLE 로 들어가면서 세션을 초기화하는 이벤트 (회의 확정) */
const RESET_TO_IDLE_EVENTS = new Set([EVENTS.GO_HOME, EVENTS.INACTIVITY_TIMEOUT, EVENTS.LISTEN_CANCEL])

/** 실패 횟수를 1 올리는 이벤트 */
const FAIL_INCREMENT_EVENTS = new Set([EVENTS.RESOLVE_NOT_UNDERSTOOD, EVENTS.CONFIRM_NONE_OF_THEM])

/** 이벤트별로 payload 를 어느 필드에 담을지. 여기 없는 이벤트는 payload 가 없다. */
function payloadFields(action) {
  switch (action.type) {
    case EVENTS.HEALTH_OK:
    case EVENTS.HEALTH_SERVER_DOWN:
    case EVENTS.MIC_OR_STT_UNAVAILABLE:
      return { health: action.health ?? null }
    case EVENTS.SPEECH_END:
      return { transcript: action.text ?? '' }
    case EVENTS.RESOLVE_NEED_CONFIRM:
      return { resolve: action.resolve ?? null }
    case EVENTS.RESOLVE_CONFIRMED:
      return { resolve: action.resolve ?? null, selectedPoi: action.resolve?.poi ?? null }
    case EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR:
    case EVENTS.ROUTE_FAILED:
      return { error: action.error ?? null }
    case EVENTS.DESTINATION_CONFIRMED:
    case EVENTS.POI_SELECTED:
      return { selectedPoi: action.poi ?? null }
    case EVENTS.ROUTE_FOUND:
      return { routes: action.routes ?? [] }
    default:
      return {}
  }
}

export function kioskReducer(state, action) {
  // 개발 도구: 어느 상태에서든 처음(health 포함)으로
  if (action.type === DEV_EVENTS.DEV_RESET) {
    return { ...initialState, lastEvent: DEV_EVENTS.DEV_RESET }
  }

  const next = nextStateOf(state.state, action.type)
  if (next === undefined) {
    // 표에 없는 조합. 조용히 통과시키지 않고 경고만 남긴 뒤 상태를 그대로 둔다.
    console.warn(`[kiosk] 표에 없는 전이: ${state.state} --(${action.type})--> ?`)
    return state
  }

  let failCount = state.failCount
  if (FAIL_INCREMENT_EVENTS.has(action.type)) failCount += 1
  if (action.type === EVENTS.SWITCH_TO_VOICE) failCount = 0

  const sessionReset = RESET_TO_IDLE_EVENTS.has(action.type) ? SESSION_RESET : {}

  return {
    ...state,
    failCount,
    ...payloadFields(action),
    ...sessionReset,
    state: next,
    lastEvent: action.type,
  }
}
