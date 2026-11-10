// QR_HANDOFF: 6 QR 전달. 처음으로만. 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당.
// QR 생성(api.createQr)은 Phase 5. 지금은 자리만 표시한다.
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'

export default function QrHandoffScreen() {
  const { dispatch } = useKiosk()
  return (
    <section>
      <h1>{STATES.QR_HANDOFF}</h1>
      <p>[QR 자리] 휴대폰으로 찍어 주세요</p>
      <button type="button" onClick={() => dispatch({ type: EVENTS.GO_HOME })}>
        처음으로
      </button>
    </section>
  )
}
