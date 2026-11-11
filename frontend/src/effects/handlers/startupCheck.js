// STARTUP_CHECK 진입 시 실행되는 effect 핸들러 (계획서 2-5절 표 첫 행).
// api.health() 와 recorder.checkMic() 를 동시에 호출하고 결과를 표의 이벤트 셋 중 하나로 바꾼다.
//
//   health() throw 또는 server === false        → HEALTH_SERVER_DOWN        (CHECKING)
//   stt === false 또는 mic.available === false  → MIC_OR_STT_UNAVAILABLE    (IDLE_REDUCED)
//   모두 정상                                    → HEALTH_OK                 (IDLE)
//
// 서버 불가와 마이크·STT 불가가 동시에 나면 서버 불가가 우선이다 (계획서 6절 9번).
// 서버가 없으면 아무것도 할 수 없으므로 CHECKING 에서 서버 복구를 먼저 기다린다.
//
// StrictMode 규칙: cancelled 플래그 + await 뒤 확인. 이 핸들러에 타이머는 없다.

import { EVENTS } from '../../state/events.js'

export function startupCheckHandler(state, dispatch, { api, recorder }) {
  let cancelled = false

  ;(async () => {
    // 두 점검은 서로 독립이므로 동시에 보낸다. allSettled 는 하나가 실패해도 다른 결과를 버리지 않는다.
    const [healthResult, micResult] = await Promise.allSettled([api.health(), recorder.checkMic()])
    if (cancelled) return // 기다리는 동안 상태를 떠났으면(StrictMode 1차 실행, DEV_RESET 등) 아무것도 하지 않는다

    // 1) 서버 판단 (우선)
    if (healthResult.status === 'rejected') {
      console.warn('[startupCheck] health() 실패:', healthResult.reason?.message)
      dispatch({ type: EVENTS.HEALTH_SERVER_DOWN, health: { server: false, mic: null, stt: null } })
      return
    }
    const { server, stt } = healthResult.value
    if (!server) {
      dispatch({ type: EVENTS.HEALTH_SERVER_DOWN, health: { server: false, mic: null, stt } })
      return
    }

    // 2) 마이크·STT 판단. checkMic() 이 throw 하면 마이크 없음으로 본다.
    const mic = micResult.status === 'fulfilled' ? micResult.value.available : false
    if (micResult.status === 'rejected') {
      console.warn('[startupCheck] checkMic() 실패:', micResult.reason?.message)
    }
    const health = { server, mic, stt }

    if (!stt || !mic) {
      dispatch({ type: EVENTS.MIC_OR_STT_UNAVAILABLE, health })
      return
    }

    // 3) 모두 정상
    dispatch({ type: EVENTS.HEALTH_OK, health })
  })()

  return () => {
    cancelled = true
  }
}
