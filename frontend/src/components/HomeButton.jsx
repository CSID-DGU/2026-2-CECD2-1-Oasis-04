// '처음으로' (GO_HOME). 조작 화면 7개의 오른쪽 칸 맨 아래, 늘 같은 자리 (디자인 문서 6절, consistency-audit.md 5절).
// FlowFrame 의 showHome 이 그린다. 화면이 따로 만들지 않는다 (예전 ScreenFrame 과 같은 규칙)

import SecondaryButton from './SecondaryButton.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { EVENTS } from '../state/events.js'

export default function HomeButton() {
  const { dispatch } = useKiosk()
  return (
    <SecondaryButton icon="home" onClick={() => dispatch({ type: EVENTS.GO_HOME })}>
      처음으로
    </SecondaryButton>
  )
}
