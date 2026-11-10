// UNAVAILABLE: 9 안내 불가. 손으로 고르기 / 처음으로. 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당.
// state.error 는 RESOLVING(범위 밖·오류) 또는 ROUTING(경로 없음·오류) 핸들러가 담아 준 문구다.
// '처음으로'(GO_HOME) 는 ScreenFrame 의 showHome 이 그린다.
import ScreenFrame from '../components/ScreenFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'

export default function UnavailableScreen() {
  const { state, dispatch } = useKiosk()
  return (
    <ScreenFrame
      title={STATES.UNAVAILABLE}
      showHome
      actions={
        <button type="button" onClick={() => dispatch({ type: EVENTS.MANUAL_SELECT_PRESSED })}>
          손으로 고르기
        </button>
      }
    >
      <p>안내해 드릴 수 없어요</p>
      <p>이유: {state.error ?? '(없음)'}</p>
    </ScreenFrame>
  )
}
