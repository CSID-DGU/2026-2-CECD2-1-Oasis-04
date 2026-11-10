// FAIL_COUNT_CHECK: 실패 횟수 분기 (판단 노드). 버튼 없음. effect 가 failCount 를 보고 FAIL_COUNT_1 / FAIL_COUNT_2 를 낸다.
// failCount 값은 사용자에게 보여 주지 않는다 (DevPanel 에서 확인).
import ScreenFrame from '../components/ScreenFrame.jsx'
import { STATES } from '../state/states.js'
import { SCREEN_TITLES } from './titles.js'

export default function FailCountCheckScreen() {
  return (
    <ScreenFrame title={SCREEN_TITLES[STATES.FAIL_COUNT_CHECK]}>
      <p>확인하고 있어요</p>
    </ScreenFrame>
  )
}
