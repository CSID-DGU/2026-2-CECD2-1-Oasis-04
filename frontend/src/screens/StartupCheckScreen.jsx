// STARTUP_CHECK: 시작 점검 (판단 노드). 버튼 없음. effect 가 /health + 마이크를 보고 다음 이벤트를 낸다.
import { STATES } from '../state/states.js'

export default function StartupCheckScreen() {
  return (
    <section>
      <h1>{STATES.STARTUP_CHECK}</h1>
      <p>점검 중...</p>
    </section>
  )
}
