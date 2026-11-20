// IDLE_REDUCED: 1 대기 (축소 운영). 마이크 버튼 숨김, '손으로 고르기'(주 버튼) 하나. 60초 재점검(RECHECK_TIMER)은 effect 담당.
// '처음으로' 없음 (표에 GO_HOME 전이가 없다).
// 모양: 확정 시안 idle-reduced-final.html, 디자인 문서 8-2절. IDLE 과 같은 틀에서 예시 대신 안내 문장
import IdleFrame from '../components/IdleFrame.jsx'
import IdleButtons from '../components/IdleButtons.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { SCREEN_TITLES } from './titles.js'

export default function IdleReducedScreen() {
  const { dispatch } = useKiosk()
  return (
    <IdleFrame
      voice={false}
      left={
        <>
          <h1 className="idle-question">{SCREEN_TITLES[STATES.IDLE_REDUCED]}</h1>
          <p className="idle-notice">
            지금은 음성 안내를 쓸 수 없어요.
            <br />
            손으로 골라 주세요
          </p>
        </>
      }
      actions={<IdleButtons voice={false} onManual={() => dispatch({ type: EVENTS.MANUAL_SELECT_PRESSED })} />}
    />
  )
}
