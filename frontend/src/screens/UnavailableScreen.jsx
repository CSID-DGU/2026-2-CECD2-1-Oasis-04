// UNAVAILABLE: 9 안내 불가. 손으로 고르기 / 처음으로. 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당.
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'

export default function UnavailableScreen() {
  const { state, dispatch } = useKiosk()
  return (
    <section>
      <h1>{STATES.UNAVAILABLE}</h1>
      <p>안내해 드릴 수 없어요</p>
      <p>이유: {state.error ?? '(없음)'}</p>
      <button type="button" onClick={() => dispatch({ type: EVENTS.MANUAL_SELECT_PRESSED })}>
        손으로 고르기
      </button>
      <button type="button" onClick={() => dispatch({ type: EVENTS.GO_HOME })}>
        처음으로
      </button>
    </section>
  )
}
