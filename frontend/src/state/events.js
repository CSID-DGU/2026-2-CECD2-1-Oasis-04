// 이벤트 상수. docs/kiosk-workflow.md 전이 표의 고유 이벤트 26개.
// APP_START 는 dispatch 되지 않고 initialState(state = STARTUP_CHECK)로 표현하므로 뺐다.
// 같은 이벤트가 여러 행에 나와도(GO_HOME 7행, INACTIVITY_TIMEOUT 6행, MANUAL_SELECT_PRESSED 4행) 상수는 하나다.
//
// 괄호 안은 dispatch 할 때 함께 보내는 payload 다. 없으면 { type } 만 보낸다.

export const EVENTS = Object.freeze({
  // 시작 점검 (STARTUP_CHECK / CHECKING)
  HEALTH_OK: 'HEALTH_OK', // ({ health })
  HEALTH_SERVER_DOWN: 'HEALTH_SERVER_DOWN', // ({ health })
  MIC_OR_STT_UNAVAILABLE: 'MIC_OR_STT_UNAVAILABLE', // ({ health })
  HEALTH_RETRY_TIMER: 'HEALTH_RETRY_TIMER',
  RECHECK_TIMER: 'RECHECK_TIMER',

  // 대기 (IDLE / IDLE_REDUCED)
  MIC_BUTTON_PRESSED: 'MIC_BUTTON_PRESSED',
  MANUAL_SELECT_PRESSED: 'MANUAL_SELECT_PRESSED',

  // 듣는 중 (LISTENING)
  SPEECH_END: 'SPEECH_END', // ({ text })  10초 무발화면 text = ''
  LISTEN_CANCEL: 'LISTEN_CANCEL',

  // 알아듣는 중 (RESOLVING)
  RESOLVE_NEED_CONFIRM: 'RESOLVE_NEED_CONFIRM', // ({ resolve })  resolve.candidates 사용
  RESOLVE_CONFIRMED: 'RESOLVE_CONFIRMED', // ({ resolve })  resolve.poi 가 selectedPoi 가 됨
  RESOLVE_NOT_UNDERSTOOD: 'RESOLVE_NOT_UNDERSTOOD', // failCount + 1
  RESOLVE_OUT_OF_SCOPE_OR_ERROR: 'RESOLVE_OUT_OF_SCOPE_OR_ERROR', // ({ error })

  // 목적지 확인 (CONFIRMING)
  DESTINATION_CONFIRMED: 'DESTINATION_CONFIRMED', // ({ poi })
  CONFIRM_NONE_OF_THEM: 'CONFIRM_NONE_OF_THEM', // failCount + 1
  CONFIRM_SAY_OTHER_PLACE: 'CONFIRM_SAY_OTHER_PLACE',

  // 실패 횟수 분기 (FAIL_COUNT_CHECK)
  FAIL_COUNT_1: 'FAIL_COUNT_1',
  FAIL_COUNT_2: 'FAIL_COUNT_2',

  // 재질문 (REASKING)
  RETRY_SPEECH: 'RETRY_SPEECH',

  // 경로 탐색 (ROUTING)
  ROUTE_FOUND: 'ROUTE_FOUND', // ({ routes })
  ROUTE_FAILED: 'ROUTE_FAILED', // ({ error })

  // 손으로 고르기 (MANUAL_SELECT)
  POI_SELECTED: 'POI_SELECTED', // ({ poi })
  SWITCH_TO_VOICE: 'SWITCH_TO_VOICE', // failCount = 0

  // 경로 안내 (ROUTE_GUIDE)
  SEND_TO_PHONE_PRESSED: 'SEND_TO_PHONE_PRESSED',

  // 조작 화면 공통
  GO_HOME: 'GO_HOME', // '처음으로' 버튼 7곳 → IDLE, 세션 초기화
  INACTIVITY_TIMEOUT: 'INACTIVITY_TIMEOUT', // 무입력 60초 6곳 → IDLE, 세션 초기화
})

// 워크플로우 표에 없는 개발 도구용 이벤트. 어느 상태에서든 initialState 로 되돌린다.
// EVENTS 와 분리해 둔 이유: "이건 워크플로우가 아니다"를 코드에서 바로 알 수 있게 하기 위해서다.
export const DEV_EVENTS = Object.freeze({
  DEV_RESET: 'DEV_RESET',
})
