// LISTENING: 2 듣는 중. 다 말했어요 / 취소 / 처음으로.
// mock 입력창과 recorder 연동은 Phase 4. 지금은 '다 말했어요'가 가짜 텍스트를 담아 SPEECH_END 를 보낸다.
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'

const FAKE_TEXT = '서울역'

export default function ListeningScreen() {
  const { dispatch } = useKiosk()
  return (
    <section>
      <h1>{STATES.LISTENING}</h1>
      <p>듣고 있어요</p>
      <button type="button" onClick={() => dispatch({ type: EVENTS.SPEECH_END, text: FAKE_TEXT })}>
        다 말했어요 (가짜: "{FAKE_TEXT}")
      </button>
      <button type="button" onClick={() => dispatch({ type: EVENTS.LISTEN_CANCEL })}>
        취소
      </button>
      <button type="button" onClick={() => dispatch({ type: EVENTS.GO_HOME })}>
        처음으로
      </button>
    </section>
  )
}
