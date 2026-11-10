// 상태 머신의 "부수효과" 실행부 (계획서 2-5절).
// 상태 이름(state.state)이 바뀔 때마다 그 상태의 핸들러를 한 번 실행하고,
// 핸들러가 돌려준 cleanup 을 useEffect cleanup 으로 넘겨 상태를 떠날 때 타이머·요청을 취소한다.
//
// 핸들러 시그니처: (state, dispatch, { api, recorder, config }) => cleanup | undefined
//   - state:    핸들러가 시작될 때의 상태 스냅샷 (failCount, selectedPoi 등을 읽는 용도)
//   - dispatch: 결과를 표의 이벤트로 보낼 때 사용
//   - 세 번째 인자: 서버·장치·설정값. 직접 import 하지 않고 주입받는다 → 테스트에서 가짜로 바꿔 끼우기 쉽다
//     (Spring 의 생성자 주입과 같은 이유)
//
// App 안에서 한 번만 호출한다. 두 곳에서 부르면 핸들러가 두 번 돌아 이벤트가 두 번 나간다.

import { useEffect, useEffectEvent } from 'react'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { api } from '../api/index.js'
import { recorder } from '../devices/recorder.js'
import { config } from '../config.js'
import { startupCheckHandler } from './handlers/startupCheck.js'
import { checkingHandler } from './handlers/checking.js'
import { idleReducedHandler } from './handlers/idleReduced.js'

// 상태 → 핸들러. 여기 없는 상태(IDLE, 사용자 버튼이 이벤트를 내는 화면)는 effect 가 없다.
// Phase 3: STARTUP_CHECK, CHECKING, IDLE_REDUCED
// Phase 4: LISTENING, RESOLVING, FAIL_COUNT_CHECK, inactivity(CONFIRMING, REASKING)
// Phase 5: ROUTING, inactivity(UNAVAILABLE, MANUAL_SELECT, ROUTE_GUIDE, QR_HANDOFF)
const HANDLERS = {
  [STATES.STARTUP_CHECK]: startupCheckHandler,
  [STATES.CHECKING]: checkingHandler,
  [STATES.IDLE_REDUCED]: idleReducedHandler,
}

const deps = { api, recorder, config }

export function useKioskEffects() {
  const { state, dispatch } = useKiosk()

  // 핸들러 실행을 "Effect Event" 로 감싼다.
  // 의존성 배열에는 state.state 만 두고 싶다(상태 이름이 바뀔 때만 핸들러 실행). 그런데 effect 본문에서
  // state 전체를 읽으면 ESLint(react-hooks/exhaustive-deps)가 "state 가 빠졌다" 고 경고하고,
  // state 를 의존성에 넣으면 상태 이름이 같아도 객체가 바뀔 때마다 핸들러가 다시 돈다.
  // useEffectEvent 로 만든 함수는 항상 최신 state·dispatch 를 보면서도 의존성 배열에 넣지 않아도 된다.
  // (React 19 공식 API. 이 경우처럼 "effect 는 A 가 바뀔 때만, 안에서는 B 의 최신 값을 읽고 싶다" 가 용도다)
  const runHandler = useEffectEvent((stateName) => {
    const handler = HANDLERS[stateName]
    if (!handler) return undefined
    return handler(state, dispatch, deps)
  })

  useEffect(() => {
    // 핸들러가 cleanup 을 돌려주면 그대로 useEffect cleanup 이 된다.
    // 상태를 떠날 때(또는 StrictMode 의 1차 실행 직후) React 가 이 cleanup 을 호출한다.
    return runHandler(state.state)
  }, [state.state])
}
