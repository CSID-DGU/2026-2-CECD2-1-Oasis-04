// ROUTING 진입 시 실행되는 effect 핸들러 (계획서 2-5절 표, StrictMode 예시).
// reducer 에 저장된 selectedPoi 로 api.route 를 부르고, 응답을 표의 이벤트 둘 중 하나로 바꾼다.
//
//   routes 가 1개 이상       → ROUTE_FOUND({ routes })   (reducer 가 routes 에 저장 → ROUTE_GUIDE)
//   routes 가 빈 배열        → ROUTE_FAILED({ error })   (reducer 가 error 에 저장 → UNAVAILABLE)
//   route() throw            → ROUTE_FAILED({ error })
//   selectedPoi 가 없음      → API 를 부르지 않고 바로 ROUTE_FAILED({ error })
//      (정상 흐름에선 오지 않는다. DevPanel 로 payload 없이 들어온 경우를 조용히 통과시키지 않기 위한 방어)
//
// StrictMode 규칙: cancelled 플래그 + 모든 await 뒤 확인. 타이머는 없다.

import { EVENTS } from '../../state/events.js'

/** 경로가 하나도 없을 때 UNAVAILABLE 화면에 보여 줄 문구 */
const NO_ROUTE_MESSAGE = '가는 길을 찾을 수 없어요'
/** 목적지 없이 ROUTING 에 들어왔을 때 문구 */
const NO_POI_MESSAGE = '목적지가 정해지지 않았어요'

export function routingHandler(state, dispatch, { api }) {
  let cancelled = false

  const poiId = state.selectedPoi?.id
  if (!poiId) {
    // API 없이 바로 실패 처리. 동기 dispatch 대신 setTimeout(…, 0) 으로 한 틱 미루는 이유는 failCountCheck.js 와 같다:
    // StrictMode 의 1차 실행 타이머는 곧바로 이어지는 cleanup 의 clearTimeout 으로 지워져 이벤트가 정확히 한 번만 나간다.
    console.warn('[routing] selectedPoi 없이 ROUTING 진입')
    const timer = setTimeout(() => {
      dispatch({ type: EVENTS.ROUTE_FAILED, error: NO_POI_MESSAGE })
    }, 0)
    return () => {
      clearTimeout(timer)
    }
  }

  ;(async () => {
    try {
      const { routes } = await api.route(poiId)
      if (cancelled) return

      if (Array.isArray(routes) && routes.length > 0) {
        dispatch({ type: EVENTS.ROUTE_FOUND, routes })
      } else {
        dispatch({ type: EVENTS.ROUTE_FAILED, error: NO_ROUTE_MESSAGE })
      }
    } catch (e) {
      if (cancelled) return
      console.warn('[routing] route 실패:', e?.message)
      dispatch({ type: EVENTS.ROUTE_FAILED, error: e?.message ?? '알 수 없는 오류' })
    }
  })()

  return () => {
    cancelled = true
  }
}
