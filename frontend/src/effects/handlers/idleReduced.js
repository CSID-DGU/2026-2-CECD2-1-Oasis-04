// IDLE_REDUCED 진입 시 실행되는 effect 핸들러 (계획서 2-5절 표, 6절 10번 확정).
// 마이크·STT 가 안 될 때 config.recheckMs(운영 60초) 뒤에 RECHECK_TIMER 를 dispatch 해
// STARTUP_CHECK 로 돌아가 재점검하게 한다. 정상으로 돌아왔으면 거기서 IDLE 로, 아니면 다시 IDLE_REDUCED 로 온다.
// 사용자가 그 사이 '손으로 고르기' 를 누르면 상태가 바뀌면서 cleanup 이 타이머를 지운다.
//
// StrictMode 규칙: cleanup 에서 clearTimeout.

import { EVENTS } from '../../state/events.js'

export function idleReducedHandler(state, dispatch, { config }) {
  const timer = setTimeout(() => {
    dispatch({ type: EVENTS.RECHECK_TIMER })
  }, config.recheckMs)

  return () => {
    clearTimeout(timer)
  }
}
