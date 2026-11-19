// STARTUP_CHECK: 시작 점검 (판단 노드). 버튼 없음. effect 가 /health + 마이크를 보고 다음 이벤트를 낸다.
// 모양: 기다림 틀(WaitFrame), 가운데 서비스 로고 (디자인 문서 10-3절. 로고는 임시, src/brand.js)
import WaitFrame from '../components/WaitFrame.jsx'
import { LOGO_RING_ICON } from '../brand.js'
import { STATES } from '../state/states.js'
import { SCREEN_TITLES } from './titles.js'

export default function StartupCheckScreen() {
  return <WaitFrame icon={LOGO_RING_ICON} core={SCREEN_TITLES[STATES.STARTUP_CHECK]} sub="잠시만 기다려 주세요" />
}
