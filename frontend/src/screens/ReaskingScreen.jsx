// REASKING: 7 재질문 (계획서 3절). 실패 1회째에 온다 (FAIL_COUNT_1).
// 자동 녹음 없음 (회의 확정). 버튼으로만 진행한다. 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당 (Phase 4 5번).
//   '다시 말하기'   → RETRY_SPEECH          (LISTENING. failCount 는 1 로 유지되어 다음 실패 시 MANUAL_SELECT)
//   '손으로 고르기' → MANUAL_SELECT_PRESSED (MANUAL_SELECT)
//   '처음으로'      → GO_HOME               (IDLE, 세션 초기화. FlowFrame 의 showHome 이 그린다)
// 모양: 확정 시안 reasking-final.html, 디자인 문서 12-1·12-2절.
//   왼쪽 칸  옅은 고리 + 마이크 → 제목 → "잘 못 알아들었어요" → 들은 말(비면 숨김) → 예시 한 줄
//            들은 말이 3줄이면 예시를 숨긴다 (고리 자리가 정해져 있어 화면 아래를 넘는다, 12-2절)
//   탓하는 느낌이 없게 오류 색·느낌표를 쓰지 않는다
// 음성 안내: 화면이 열리면 "잘 못 알아들었어요" 와 누를 버튼을 읽는다 (view/speechText.js reaskSpeech, 2026-11-22)

import FlowFrame from '../components/FlowFrame.jsx'
import PrimaryButton from '../components/PrimaryButton.jsx'
import SecondaryButton from '../components/SecondaryButton.jsx'
import RingStack from '../components/RingStack.jsx'
import HeardLine from '../components/HeardLine.jsx'
import SayExamples from '../components/SayExamples.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { SCREEN_TITLES } from './titles.js'
import { REASK_EXAMPLES, HIDE_EXAMPLES_AT_HEARD_LINES } from './sayExamples.js'
import { useLineCount } from '../hooks/useLineCount.js'
import { useSay } from '../effects/useSay.js'
import { reaskSpeech } from '../view/speechText.js'

const RING = { tone: 'soft', icon: 'mic' }

export default function ReaskingScreen() {
  const { state, dispatch } = useKiosk()
  useSay(reaskSpeech())
  const [heardRef, heardLines] = useLineCount(state.transcript)
  const showExamples = heardLines < HIDE_EXAMPLES_AT_HEARD_LINES
  return (
    <FlowFrame
      countdown
      showHome
      left={
        <RingStack ring={RING} title={SCREEN_TITLES[STATES.REASKING]} core="잘 못 알아들었어요">
          <HeardLine text={state.transcript} lineRef={heardRef} />
          {showExamples && <SayExamples examples={REASK_EXAMPLES} />}
        </RingStack>
      }
      actions={
        <>
          <PrimaryButton icon="mic" onClick={() => dispatch({ type: EVENTS.RETRY_SPEECH })}>
            다시 말하기
          </PrimaryButton>
          <SecondaryButton icon="touch_app" onClick={() => dispatch({ type: EVENTS.MANUAL_SELECT_PRESSED })}>
            손으로 고르기
          </SecondaryButton>
        </>
      }
    />
  )
}
