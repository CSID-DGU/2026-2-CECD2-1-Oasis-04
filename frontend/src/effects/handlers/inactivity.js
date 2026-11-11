// 무입력 복귀 공통 effect 핸들러 (계획서 2-5절 표, 6절 7번 확정).
// 사용자가 조작하다 자리를 떠나도 키오스크가 멈추지 않도록, config.inactivityMs(운영 60초) 동안 아무 입력이 없으면
// INACTIVITY_TIMEOUT 을 dispatch 해 IDLE 로 돌아간다 (reducer 가 failCount 와 세션 필드를 비운다).
//
// 같은 함수 하나를 여섯 상태가 공유한다:
//   Phase 4: CONFIRMING, REASKING
//   Phase 5: UNAVAILABLE, MANUAL_SELECT, ROUTE_GUIDE, QR_HANDOFF
// LISTENING 은 빠진다. 거기서는 recorder 의 10초 무발화 타이머가 같은 역할을 한다.
//
// "입력" 은 document 전체의 pointerdown(터치·마우스)과 keydown(키보드) 으로 감지한다.
// 화면 어디를 건드리든 타이머가 처음부터 다시 돈다. 버튼을 눌러 상태가 바뀌면 cleanup 이 타이머와 리스너를 함께 거둔다.
//
// StrictMode 규칙: cleanup 에서 clearTimeout 과 removeEventListener 둘 다 한다.
// 리스너는 add 와 remove 에 반드시 같은 함수 참조(resetTimer)를 넘겨야 떼어진다.

import { EVENTS } from '../../state/events.js'

/** 사용자 입력으로 보는 document 이벤트. 터치·마우스는 pointerdown 하나로 다 들어온다. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown']

export function inactivityHandler(state, dispatch, { config }) {
  let timer = null

  const armTimer = () => {
    timer = setTimeout(() => {
      timer = null
      dispatch({ type: EVENTS.INACTIVITY_TIMEOUT })
    }, config.inactivityMs)
  }

  // 입력이 올 때마다 기존 타이머를 지우고 새로 건다. add/remove 양쪽에 같은 참조를 넘기기 위해 변수로 둔다.
  const resetTimer = () => {
    if (timer !== null) clearTimeout(timer)
    armTimer()
  }

  armTimer()
  for (const name of ACTIVITY_EVENTS) document.addEventListener(name, resetTimer)

  return () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    for (const name of ACTIVITY_EVENTS) document.removeEventListener(name, resetTimer)
  }
}
