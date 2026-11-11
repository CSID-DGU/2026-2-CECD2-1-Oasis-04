// CHECKING 진입 시 실행되는 effect 핸들러 (계획서 2-5절 표).
// 서버가 내려가 있을 때 config.healthRetryMs(운영 30초) 뒤에 HEALTH_RETRY_TIMER 를 dispatch 해
// STARTUP_CHECK 로 돌아가 다시 점검하게 한다. API 호출은 없고 타이머만 있다.
//
// StrictMode 규칙: cleanup 에서 clearTimeout. 1차 실행의 타이머는 cleanup 으로 지워지므로
// 2차 실행의 타이머 하나만 남아 이벤트는 한 번만 나간다.
// 화면의 "남은 초" 카운트다운은 CheckingScreen 이 따로 그린다 (표시용. 전이는 이 타이머가 낸다).

import { EVENTS } from '../../state/events.js'

export function checkingHandler(state, dispatch, { config }) {
  const timer = setTimeout(() => {
    dispatch({ type: EVENTS.HEALTH_RETRY_TIMER })
  }, config.healthRetryMs)

  return () => {
    clearTimeout(timer)
  }
}
