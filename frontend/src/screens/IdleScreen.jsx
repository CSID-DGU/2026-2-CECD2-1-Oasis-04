// IDLE: 1 대기. 마이크 버튼 + 손으로 고르기. '처음으로' 없음.
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'

export default function IdleScreen() {
  const { dispatch } = useKiosk()
  return (
    <section>
      <h1>{STATES.IDLE}</h1>
      <p>어디로 가시나요?</p>
      <button type="button" onClick={() => dispatch({ type: EVENTS.MIC_BUTTON_PRESSED })}>
        말하기
      </button>
      <button type="button" onClick={() => dispatch({ type: EVENTS.MANUAL_SELECT_PRESSED })}>
        손으로 고르기
      </button>
    </section>
  )
}
