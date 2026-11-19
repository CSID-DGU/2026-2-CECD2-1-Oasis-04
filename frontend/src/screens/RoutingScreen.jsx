// ROUTING: 3-2 가는 길 찾는 중 (/route). 버튼 없음. ROUTE_FOUND / ROUTE_FAILED 는 effect 담당.
// 모양: 기다림 틀, 가운데 깃발. 가실 곳 / 고른 목적지 이름 / 가는 길을 찾고 있어요 (디자인 문서 10-3절)
// 목적지가 없을 때(전이 표상 생기지 않지만 안전장치): RESOLVING 빈 값 규칙과 같이 머리말·안내를 빼고 제목을 큰 글씨로
import WaitFrame from '../components/WaitFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { SCREEN_TITLES } from './titles.js'

export default function RoutingScreen() {
  const { state } = useKiosk()
  const name = state.selectedPoi?.name?.trim() ?? ''
  const title = SCREEN_TITLES[STATES.ROUTING]
  if (!name) return <WaitFrame icon="flag" core={title} />
  return <WaitFrame icon="flag" label="가실 곳" core={name} sub={title} />
}
