// UNAVAILABLE: 9 안내 불가. 손으로 고르기 / 처음으로. 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당.
// state.error 는 RESOLVING(범위 밖·오류) 또는 ROUTING(경로 없음·오류) 핸들러가 담아 준 문구다.
// 화면에는 toDisplayMessage(state.error) 를 보여 준다: 문장이면 그대로, 'STT_ERROR' 같은 코드면 공통 문구 (errorMessage.js).
// 원래 값은 reducer 에 그대로 있고 DevPanel 의 error 줄에서 볼 수 있다.
// '처음으로'(GO_HOME) 는 ScreenFrame 의 showHome 이 그린다.
import ScreenFrame from '../components/ScreenFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { SCREEN_TITLES } from './titles.js'
import { toDisplayMessage } from './errorMessage.js'

export default function UnavailableScreen() {
  const { state, dispatch } = useKiosk()
  return (
    <ScreenFrame
      title={SCREEN_TITLES[STATES.UNAVAILABLE]}
      showHome
      actions={
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: EVENTS.MANUAL_SELECT_PRESSED })}>
          손으로 고르기
        </button>
      }
    >
      <p className="error">{toDisplayMessage(state.error)}</p>
    </ScreenFrame>
  )
}
