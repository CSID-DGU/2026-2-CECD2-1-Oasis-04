// ROUTE_GUIDE: 5 경로 안내. 휴대폰으로 보내기 / 처음으로. 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당.
// 1순위 크게 + 2·3순위 작게 표시는 Phase 5. 지금은 경로 개수만 보여 준다.
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'

export default function RouteGuideScreen() {
  const { state, dispatch } = useKiosk()
  return (
    <section>
      <h1>{STATES.ROUTE_GUIDE}</h1>
      <p>목적지: {state.selectedPoi?.name ?? '(없음)'}</p>
      <p>경로 {state.routes.length}개</p>
      <button type="button" onClick={() => dispatch({ type: EVENTS.SEND_TO_PHONE_PRESSED })}>
        휴대폰으로 보내기
      </button>
      <button type="button" onClick={() => dispatch({ type: EVENTS.GO_HOME })}>
        처음으로
      </button>
    </section>
  )
}
