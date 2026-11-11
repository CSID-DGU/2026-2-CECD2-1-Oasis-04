// STARTUP_CHECK: 시작 점검 (판단 노드). 버튼 없음. effect 가 /health + 마이크를 보고 다음 이벤트를 낸다.
import ScreenFrame from '../components/ScreenFrame.jsx'
import { STATES } from '../state/states.js'
import { SCREEN_TITLES } from './titles.js'

export default function StartupCheckScreen() {
  return (
    <ScreenFrame title={SCREEN_TITLES[STATES.STARTUP_CHECK]}>
      <p>잠시만 기다려 주세요</p>
    </ScreenFrame>
  )
}
