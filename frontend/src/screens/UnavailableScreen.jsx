// UNAVAILABLE: 9 안내 불가. 손으로 고르기 / 처음으로. 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당.
// state.error 는 { code, message } 다 (docs/frontend-plan.md 2-3절). RESOLVING(범위 밖·오류) 또는 ROUTING(경로 없음·오류) 핸들러가 담는다.
// 모양: 확정 시안 unavailable-final.html, 디자인 문서 12-1·12-3절.
//   왼쪽 칸  본문색 고리 + 이유 그림 → 제목 → 이유 첫 문장(72px 굵게, 오류 색) → 나머지 문장(36px)
//   그림과 문구는 view/unavailableReason.js 가 코드로 고른다. 글자는 바꾸지 않고 첫 ". " 뒤에서 나눈다
// '처음으로'(GO_HOME) 는 FlowFrame 의 showHome 이 그린다.

import FlowFrame from '../components/FlowFrame.jsx'
import PrimaryButton from '../components/PrimaryButton.jsx'
import RingStack from '../components/RingStack.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { SCREEN_TITLES } from './titles.js'
import { reasonOf, splitFirstSentence } from '../view/unavailableReason.js'
import { evenWrapClass } from '../view/textWrap.js'

export default function UnavailableScreen() {
  const { state, dispatch } = useKiosk()
  const reason = reasonOf(state.error)
  const [first, rest] = splitFirstSentence(reason.text)
  return (
    <FlowFrame
      showHome
      left={
        <RingStack ring={{ tone: 'text', icon: reason.icon }} title={SCREEN_TITLES[STATES.UNAVAILABLE]} core={first} coreError>
          {rest && <p className={`ring-stack-more ${evenWrapClass(rest)}`}>{rest}</p>}
        </RingStack>
      }
      actions={
        <PrimaryButton icon="touch_app" onClick={() => dispatch({ type: EVENTS.MANUAL_SELECT_PRESSED })}>
          손으로 고르기
        </PrimaryButton>
      }
    />
  )
}
