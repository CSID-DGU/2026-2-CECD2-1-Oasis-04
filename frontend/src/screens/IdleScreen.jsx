// IDLE: 1 대기. 마이크 버튼 + 손으로 고르기. '처음으로' 없음 (표에 GO_HOME 전이가 없다).
import ScreenFrame from '../components/ScreenFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { SCREEN_TITLES } from './titles.js'

export default function IdleScreen() {
  const { dispatch } = useKiosk()
  return (
    <ScreenFrame
      title={SCREEN_TITLES[STATES.IDLE]}
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: EVENTS.MIC_BUTTON_PRESSED })}>
            말하기
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: EVENTS.MANUAL_SELECT_PRESSED })}>
            손으로 고르기
          </button>
        </>
      }
    >
      <p>버튼을 누르고 말씀하시거나, 손으로 골라 주세요</p>
    </ScreenFrame>
  )
}
