// IDLE_REDUCED: 1 대기 (축소 운영). 마이크 버튼 숨김, 손으로 고르기만. 60초 재점검(RECHECK_TIMER)은 effect 담당.
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'

export default function IdleReducedScreen() {
  const { dispatch } = useKiosk()
  return (
    <section>
      <h1>{STATES.IDLE_REDUCED}</h1>
      <p>지금은 음성 안내를 쓸 수 없어요. 손으로 골라 주세요</p>
      <button type="button" onClick={() => dispatch({ type: EVENTS.MANUAL_SELECT_PRESSED })}>
        손으로 고르기
      </button>
    </section>
  )
}
