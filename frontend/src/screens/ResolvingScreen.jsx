// RESOLVING: 3-1 말씀 알아듣는 중 (/stt → /resolve). 버튼 없음. 결과 이벤트 4종은 effect 담당.
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'

export default function ResolvingScreen() {
  const { state } = useKiosk()
  return (
    <section>
      <h1>{STATES.RESOLVING}</h1>
      <p>말씀 알아듣는 중...</p>
      <p>들은 말: "{state.transcript}"</p>
    </section>
  )
}
