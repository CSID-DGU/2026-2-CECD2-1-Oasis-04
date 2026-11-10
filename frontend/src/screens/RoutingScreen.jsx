// ROUTING: 3-2 가는 길 찾는 중 (/route). 버튼 없음. ROUTE_FOUND / ROUTE_FAILED 는 effect 담당.
import ScreenFrame from '../components/ScreenFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'

export default function RoutingScreen() {
  const { state } = useKiosk()
  return (
    <ScreenFrame title={STATES.ROUTING}>
      <p>가는 길 찾는 중...</p>
      <p>목적지: {state.selectedPoi?.name ?? '(없음)'}</p>
    </ScreenFrame>
  )
}
