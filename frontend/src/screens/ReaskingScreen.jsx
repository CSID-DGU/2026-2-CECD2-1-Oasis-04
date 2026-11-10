// REASKING: 7 재질문 (계획서 3절). 실패 1회째에 온다 (FAIL_COUNT_1).
// 자동 녹음 없음 (회의 확정). 버튼으로만 진행한다. 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당 (Phase 4 5번).
//   '다시 말하기'   → RETRY_SPEECH          (LISTENING. failCount 는 1 로 유지되어 다음 실패 시 MANUAL_SELECT)
//   '손으로 고르기' → MANUAL_SELECT_PRESSED (MANUAL_SELECT)
//   '처음으로'      → GO_HOME               (IDLE, 세션 초기화. ScreenFrame 의 showHome 이 그린다)
// 들은 말(transcript)이 있으면 같이 보여 준다. 10초 무발화로 온 경우엔 빈 문자열이라 표시하지 않는다.

import ScreenFrame from '../components/ScreenFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { SCREEN_TITLES } from './titles.js'

export default function ReaskingScreen() {
  const { state, dispatch } = useKiosk()
  return (
    <ScreenFrame
      title={SCREEN_TITLES[STATES.REASKING]}
      showHome
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: EVENTS.RETRY_SPEECH })}>
            다시 말하기
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: EVENTS.MANUAL_SELECT_PRESSED })}>
            손으로 고르기
          </button>
        </>
      }
    >
      <p>잘 못 알아들었어요</p>
      {state.transcript && <p>들은 말: "{state.transcript}"</p>}
    </ScreenFrame>
  )
}
