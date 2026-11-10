// CONFIRMING: 4 목적지 확인. 예 / 모두 아니에요 / 다른 곳 말하기 / 처음으로.
// 자동 녹음 없음 (회의 확정). 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당.
// '예'는 resolve.candidates 의 첫 후보가 있으면 그것을, 없으면 가짜 poi 를 담아 DESTINATION_CONFIRMED 를 보낸다.
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'

const FAKE_POI = { id: 'poi-seoul-station', name: '서울역', category: '지하철역' }

export default function ConfirmingScreen() {
  const { state, dispatch } = useKiosk()
  const poi = state.resolve?.candidates?.[0] ?? state.resolve?.poi ?? FAKE_POI
  return (
    <section>
      <h1>{STATES.CONFIRMING}</h1>
      <p>"{poi.name}" 맞나요?</p>
      <button type="button" onClick={() => dispatch({ type: EVENTS.DESTINATION_CONFIRMED, poi })}>
        예
      </button>
      <button type="button" onClick={() => dispatch({ type: EVENTS.CONFIRM_NONE_OF_THEM })}>
        모두 아니에요
      </button>
      <button type="button" onClick={() => dispatch({ type: EVENTS.CONFIRM_SAY_OTHER_PLACE })}>
        다른 곳 말하기
      </button>
      <button type="button" onClick={() => dispatch({ type: EVENTS.GO_HOME })}>
        처음으로
      </button>
    </section>
  )
}
