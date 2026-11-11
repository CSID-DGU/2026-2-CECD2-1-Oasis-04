// 전이 표. docs/kiosk-workflow.md 의 41행 중 APP_START 행을 뺀 40항목.
// 모양: { [현재 상태]: { [이벤트]: 다음 상태 } }
// APP_START 는 initialState.state = STARTUP_CHECK 로 표현한다 (kioskReducer.js).
//
// 여기에 없는 (상태, 이벤트) 조합은 reducer 가 상태를 바꾸지 않고 console.warn 만 남긴다.
// 전이를 추가·수정할 때는 코드보다 문서(docs/kiosk-workflow.md)를 먼저 고친다.

import { STATES as S } from './states.js'
import { EVENTS as E } from './events.js'

export const transitions = Object.freeze({
  // ── 시작 점검 ──────────────────────────────── 3
  [S.STARTUP_CHECK]: {
    [E.HEALTH_SERVER_DOWN]: S.CHECKING,
    [E.HEALTH_OK]: S.IDLE,
    [E.MIC_OR_STT_UNAVAILABLE]: S.IDLE_REDUCED,
  },
  // ── 0 점검 중 ──────────────────────────────── 1
  [S.CHECKING]: {
    [E.HEALTH_RETRY_TIMER]: S.STARTUP_CHECK, // 30초마다 재시도
  },
  // ── 1 대기 ─────────────────────────────────── 2
  [S.IDLE]: {
    [E.MIC_BUTTON_PRESSED]: S.LISTENING,
    [E.MANUAL_SELECT_PRESSED]: S.MANUAL_SELECT,
  },
  // ── 1 대기 (축소 운영) ─────────────────────── 2
  [S.IDLE_REDUCED]: {
    [E.MANUAL_SELECT_PRESSED]: S.MANUAL_SELECT,
    [E.RECHECK_TIMER]: S.STARTUP_CHECK, // 60초마다 재점검
  },
  // ── 2 듣는 중 ──────────────────────────────── 3
  [S.LISTENING]: {
    [E.SPEECH_END]: S.RESOLVING, // 무음 2.5초 · 다 말했어요 · 10초 무발화(빈 텍스트)
    [E.LISTEN_CANCEL]: S.IDLE,
    [E.GO_HOME]: S.IDLE,
  },
  // ── 3-1 말씀 알아듣는 중 ───────────────────── 4
  [S.RESOLVING]: {
    [E.RESOLVE_NEED_CONFIRM]: S.CONFIRMING,
    [E.RESOLVE_CONFIRMED]: S.ROUTING,
    [E.RESOLVE_NOT_UNDERSTOOD]: S.FAIL_COUNT_CHECK,
    [E.RESOLVE_OUT_OF_SCOPE_OR_ERROR]: S.UNAVAILABLE,
  },
  // ── 4 목적지 확인 ──────────────────────────── 5
  [S.CONFIRMING]: {
    [E.DESTINATION_CONFIRMED]: S.ROUTING,
    [E.CONFIRM_NONE_OF_THEM]: S.FAIL_COUNT_CHECK,
    [E.CONFIRM_SAY_OTHER_PLACE]: S.LISTENING,
    [E.GO_HOME]: S.IDLE,
    [E.INACTIVITY_TIMEOUT]: S.IDLE,
  },
  // ── 실패 횟수 분기 ─────────────────────────── 2
  [S.FAIL_COUNT_CHECK]: {
    [E.FAIL_COUNT_1]: S.REASKING,
    [E.FAIL_COUNT_2]: S.MANUAL_SELECT,
  },
  // ── 7 재질문 ───────────────────────────────── 4
  [S.REASKING]: {
    [E.RETRY_SPEECH]: S.LISTENING,
    [E.MANUAL_SELECT_PRESSED]: S.MANUAL_SELECT,
    [E.GO_HOME]: S.IDLE,
    [E.INACTIVITY_TIMEOUT]: S.IDLE,
  },
  // ── 3-2 가는 길 찾는 중 ────────────────────── 2
  [S.ROUTING]: {
    [E.ROUTE_FOUND]: S.ROUTE_GUIDE,
    [E.ROUTE_FAILED]: S.UNAVAILABLE,
  },
  // ── 9 안내 불가 ────────────────────────────── 3
  [S.UNAVAILABLE]: {
    [E.MANUAL_SELECT_PRESSED]: S.MANUAL_SELECT,
    [E.GO_HOME]: S.IDLE,
    [E.INACTIVITY_TIMEOUT]: S.IDLE,
  },
  // ── 8 손으로 고르기 ────────────────────────── 4
  [S.MANUAL_SELECT]: {
    [E.POI_SELECTED]: S.ROUTING,
    [E.SWITCH_TO_VOICE]: S.LISTENING,
    [E.GO_HOME]: S.IDLE,
    [E.INACTIVITY_TIMEOUT]: S.IDLE,
  },
  // ── 5 경로 안내 ────────────────────────────── 3
  [S.ROUTE_GUIDE]: {
    [E.SEND_TO_PHONE_PRESSED]: S.QR_HANDOFF,
    [E.GO_HOME]: S.IDLE,
    [E.INACTIVITY_TIMEOUT]: S.IDLE,
  },
  // ── 6 QR 전달 ──────────────────────────────── 2
  [S.QR_HANDOFF]: {
    [E.GO_HOME]: S.IDLE,
    [E.INACTIVITY_TIMEOUT]: S.IDLE,
  },
}) // 합계 40

/** (현재 상태, 이벤트) → 다음 상태. 표에 없으면 undefined. */
export function nextStateOf(state, event) {
  return transitions[state]?.[event]
}
