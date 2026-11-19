// IDLE: 1 대기. '말하기'(주 버튼) + '손으로 고르기'. '처음으로' 없음 (표에 GO_HOME 전이가 없다).
// 모양: 확정 시안 idle-final-subway.html / -bus.html / -default.html, 디자인 문서 8절.
//   위쪽 큰 띠(PlaceBand)에 지금 계신 곳을 보인다 (위치 조회는 LocationContext. 표시용 조회라 전이가 없다)
//   왼쪽 질문 "어디로 가시나요?" + 예시 세 줄, 오른쪽 큰 버튼 묶음
import IdleFrame from '../components/IdleFrame.jsx'
import IdleButtons from '../components/IdleButtons.jsx'
import SayExamples from '../components/SayExamples.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { SCREEN_TITLES } from './titles.js'
import { SAY_EXAMPLES } from './sayExamples.js'

export default function IdleScreen() {
  const { dispatch } = useKiosk()
  return (
    <IdleFrame
      left={
        <>
          <h1 className="idle-question">{SCREEN_TITLES[STATES.IDLE]}</h1>
          <SayExamples examples={SAY_EXAMPLES} />
        </>
      }
      actions={
        <IdleButtons
          voice
          onSpeak={() => dispatch({ type: EVENTS.MIC_BUTTON_PRESSED })}
          onManual={() => dispatch({ type: EVENTS.MANUAL_SELECT_PRESSED })}
        />
      }
    />
  )
}
