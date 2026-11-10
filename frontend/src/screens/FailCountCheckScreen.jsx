// FAIL_COUNT_CHECK: 실패 횟수 분기 (판단 노드). 버튼 없음. effect 가 failCount 를 보고 FAIL_COUNT_1 / FAIL_COUNT_2 를 낸다.
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'

export default function FailCountCheckScreen() {
  const { state } = useKiosk()
  return (
    <section>
      <h1>{STATES.FAIL_COUNT_CHECK}</h1>
      <p>실패 횟수 확인 중... (failCount = {state.failCount})</p>
    </section>
  )
}
