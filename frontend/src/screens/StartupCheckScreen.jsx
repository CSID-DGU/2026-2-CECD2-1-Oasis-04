// STARTUP_CHECK: 시작 점검 (판단 노드). 버튼 없음. effect 가 /health + 마이크를 보고 다음 이벤트를 낸다.
import ScreenFrame from '../components/ScreenFrame.jsx'
import { STATES } from '../state/states.js'

export default function StartupCheckScreen() {
  return (
    <ScreenFrame title={STATES.STARTUP_CHECK}>
      <p>점검 중...</p>
    </ScreenFrame>
  )
}
