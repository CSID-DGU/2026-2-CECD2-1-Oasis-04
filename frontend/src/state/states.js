// 상태 상수 14개. docs/kiosk-workflow.md 의 상태 이름을 문자열 그대로 쓴다.
// 화면 상태 12개 + 판단 노드 2개(STARTUP_CHECK, FAIL_COUNT_CHECK).
// 문자열을 그대로 쓰는 이유: 개발자 패널에 찍히는 값과 문서를 눈으로 바로 대조하기 위해서다.

export const STATES = Object.freeze({
  // 판단 노드 (화면 없이 스피너만 잠깐 보인다)
  STARTUP_CHECK: 'STARTUP_CHECK', // 시작 점검 (/health + 마이크)
  FAIL_COUNT_CHECK: 'FAIL_COUNT_CHECK', // 실패 횟수 분기

  // 화면 상태
  CHECKING: 'CHECKING', // 0 점검 중
  IDLE: 'IDLE', // 1 대기
  IDLE_REDUCED: 'IDLE_REDUCED', // 1 대기 (축소 운영) · 마이크 버튼 숨김
  LISTENING: 'LISTENING', // 2 듣는 중
  RESOLVING: 'RESOLVING', // 3-1 찾는 중 · 말씀 알아듣는 중 (/stt → /resolve)
  ROUTING: 'ROUTING', // 3-2 찾는 중 · 가는 길 찾는 중 (/route)
  CONFIRMING: 'CONFIRMING', // 4 목적지 확인
  ROUTE_GUIDE: 'ROUTE_GUIDE', // 5 경로 안내 · 경로 3개 · 1순위 크게
  QR_HANDOFF: 'QR_HANDOFF', // 6 QR 전달
  REASKING: 'REASKING', // 7 재질문
  MANUAL_SELECT: 'MANUAL_SELECT', // 8 손으로 고르기
  UNAVAILABLE: 'UNAVAILABLE', // 9 안내 불가
})

/** 판단 노드. 진입 즉시 effect 가 조건을 보고 다음 이벤트를 dispatch 한다. */
export const CHOICE_STATES = Object.freeze([STATES.STARTUP_CHECK, STATES.FAIL_COUNT_CHECK])

/** '처음으로' 버튼(GO_HOME)이 있는 조작 화면 7곳 */
export const HOME_BUTTON_STATES = Object.freeze([
  STATES.LISTENING,
  STATES.CONFIRMING,
  STATES.REASKING,
  STATES.UNAVAILABLE,
  STATES.MANUAL_SELECT,
  STATES.ROUTE_GUIDE,
  STATES.QR_HANDOFF,
])

/** 무입력 60초(INACTIVITY_TIMEOUT)로 IDLE 복귀하는 화면 6곳. LISTENING 은 10초 무발화가 대신한다. */
export const INACTIVITY_STATES = Object.freeze([
  STATES.CONFIRMING,
  STATES.REASKING,
  STATES.UNAVAILABLE,
  STATES.MANUAL_SELECT,
  STATES.ROUTE_GUIDE,
  STATES.QR_HANDOFF,
])
