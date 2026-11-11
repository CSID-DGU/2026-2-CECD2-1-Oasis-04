// RESOLVING: 3-1 말씀 알아듣는 중 (/stt → /resolve). 버튼 없음. 결과 이벤트 4종은 effect 담당.
import ScreenFrame from '../components/ScreenFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { SCREEN_TITLES } from './titles.js'

export default function ResolvingScreen() {
  const { state } = useKiosk()
  return (
    <ScreenFrame title={SCREEN_TITLES[STATES.RESOLVING]}>
      {/* 10초 무발화로 온 경우 transcript 가 빈 문자열이라 '들은 말' 줄은 숨긴다 */}
      {state.transcript && <p>들은 말: "{state.transcript}"</p>}
    </ScreenFrame>
  )
}
