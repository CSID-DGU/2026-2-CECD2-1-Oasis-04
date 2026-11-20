// RESOLVING: 3-1 말씀 알아듣는 중 (/stt → /resolve). 버튼 없음. 결과 이벤트 4종은 effect 담당.
// 모양: 기다림 틀, 가운데 말풍선. 들은 말 / “들은 말” / 말씀을 알아듣는 중이에요 (디자인 문서 10-3절)
// 들은 말이 비어 있으면(LISTENING 에서 10초 무발화 → 빈 글로 SPEECH_END): 머리말과 안내 줄을 빼고
// 큰 글씨 자리에 "말씀을 알아듣는 중이에요" 를 둔다 (10-3절 빈 값 규칙). 공백만 있는 글도 빈 것으로 본다
import WaitFrame from '../components/WaitFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { SCREEN_TITLES } from './titles.js'

export default function ResolvingScreen() {
  const { state } = useKiosk()
  const heard = state.transcript?.trim() ?? ''
  const title = SCREEN_TITLES[STATES.RESOLVING]
  if (!heard) return <WaitFrame icon="bubble" core={title} />
  return <WaitFrame icon="bubble" label="들은 말" core={`“${heard}”`} sub={title} />
}
