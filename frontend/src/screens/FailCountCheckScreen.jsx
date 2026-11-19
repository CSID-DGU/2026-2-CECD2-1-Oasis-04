// FAIL_COUNT_CHECK: 실패 횟수 분기 (판단 노드). 버튼 없음. effect 가 failCount 를 보고 FAIL_COUNT_1 / FAIL_COUNT_2 를 낸다.
// failCount 값은 사용자에게 보여 주지 않는다 (DevPanel 에서 확인).
// 모양: 기다림 틀, 가운데 말풍선. 잠시만요 / 확인하고 있어요 (디자인 문서 10-3절)
import WaitFrame from '../components/WaitFrame.jsx'
import { STATES } from '../state/states.js'
import { SCREEN_TITLES } from './titles.js'

export default function FailCountCheckScreen() {
  return <WaitFrame icon="bubble" core={SCREEN_TITLES[STATES.FAIL_COUNT_CHECK]} sub="확인하고 있어요" />
}
