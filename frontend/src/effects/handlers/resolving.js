// RESOLVING 진입 시 실행되는 effect 핸들러 (계획서 2-5절 표).
// reducer 에 저장된 transcript 를 api.stt → api.resolve 순으로 보내고, 응답을 표의 이벤트 넷 중 하나로 바꾼다.
//
//   status OK,  needConfirm false → RESOLVE_CONFIRMED          ({ resolve }  reducer 가 resolve.poi 를 selectedPoi 로)
//   status OK,  needConfirm true  → RESOLVE_NEED_CONFIRM       ({ resolve }  CONFIRMING 이 resolve.candidates 를 보여 줌)
//   status NOT_UNDERSTOOD         → RESOLVE_NOT_UNDERSTOOD     (reducer 가 failCount + 1)
//   status OUT_OF_SCOPE           → RESOLVE_OUT_OF_SCOPE_OR_ERROR ({ error })
//   stt() 또는 resolve() throw    → RESOLVE_OUT_OF_SCOPE_OR_ERROR ({ error })
//
// mock 에서 stt 의 입력은 { text } 객체다 (mockRecorder 가 음성 대신 텍스트를 넘기므로).
// 실제 마이크로 바꾸면 recorder 가 { audio } 를 주고 real/stt.js 가 그것을 받도록 바뀐다. 이 핸들러는 그대로다.
//
// StrictMode 규칙: cancelled 플래그 + 모든 await 뒤 확인. 타이머는 없다.

import { EVENTS } from '../../state/events.js'

/** OUT_OF_SCOPE 응답일 때 UNAVAILABLE 화면에 보여 줄 문구 */
const OUT_OF_SCOPE_MESSAGE = '이 키오스크에서 안내할 수 없는 곳이에요'

export function resolvingHandler(state, dispatch, { api }) {
  let cancelled = false

  ;(async () => {
    try {
      // 1) STT: reducer 의 transcript 를 음성 대신 보낸다
      const { text } = await api.stt({ text: state.transcript })
      if (cancelled) return

      // 2) 목적지 해석
      const result = await api.resolve(text)
      if (cancelled) return

      // 3) 응답 → 이벤트
      if (result.status === 'OK') {
        if (result.needConfirm) {
          dispatch({ type: EVENTS.RESOLVE_NEED_CONFIRM, resolve: result })
        } else {
          dispatch({ type: EVENTS.RESOLVE_CONFIRMED, resolve: result })
        }
        return
      }
      if (result.status === 'NOT_UNDERSTOOD') {
        dispatch({ type: EVENTS.RESOLVE_NOT_UNDERSTOOD })
        return
      }
      if (result.status === 'OUT_OF_SCOPE') {
        dispatch({ type: EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR, error: OUT_OF_SCOPE_MESSAGE })
        return
      }
      // 표에 없는 status. 백엔드 형식이 바뀐 경우이므로 오류로 처리하고 경고를 남긴다.
      console.warn('[resolving] 알 수 없는 resolve status:', result.status)
      dispatch({ type: EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR, error: `알 수 없는 응답 (${result.status})` })
    } catch (e) {
      if (cancelled) return
      console.warn('[resolving] stt/resolve 실패:', e?.message)
      dispatch({ type: EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR, error: e?.message ?? '알 수 없는 오류' })
    }
  })()

  return () => {
    cancelled = true
  }
}
