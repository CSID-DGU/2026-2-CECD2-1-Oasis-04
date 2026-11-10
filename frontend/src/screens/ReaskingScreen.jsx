// REASKING: 7 재질문. 다시 말하기 / 손으로 고르기 / 처음으로.
// 자동 녹음 없음 (회의 확정). 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당.
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'

export default function ReaskingScreen() {
  const { dispatch } = useKiosk()
  return (
    <section>
      <h1>{STATES.REASKING}</h1>
      <p>잘 못 알아들었어요. 다시 말씀해 주세요</p>
      <button type="button" onClick={() => dispatch({ type: EVENTS.RETRY_SPEECH })}>
        다시 말하기
      </button>
      <button type="button" onClick={() => dispatch({ type: EVENTS.MANUAL_SELECT_PRESSED })}>
        손으로 고르기
      </button>
      <button type="button" onClick={() => dispatch({ type: EVENTS.GO_HOME })}>
        처음으로
      </button>
    </section>
  )
}
