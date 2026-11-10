// MANUAL_SELECT: 8 손으로 고르기. 목적지 버튼 / 말로 하기 / 처음으로.
// 목적지 목록(api.getPois)은 Phase 5. 지금은 가짜 목적지 2개를 버튼으로 둔다.
// 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당.
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'

const FAKE_POIS = [
  { id: 'poi-city-hall', name: '시청', category: '관공서' },
  { id: 'poi-no-route', name: '경로 없는 곳 (오류 확인용)', category: '테스트' },
]

export default function ManualSelectScreen() {
  const { dispatch } = useKiosk()
  return (
    <section>
      <h1>{STATES.MANUAL_SELECT}</h1>
      <p>가실 곳을 골라 주세요</p>
      {FAKE_POIS.map((poi) => (
        <button key={poi.id} type="button" onClick={() => dispatch({ type: EVENTS.POI_SELECTED, poi })}>
          {poi.name}
        </button>
      ))}
      <button type="button" onClick={() => dispatch({ type: EVENTS.SWITCH_TO_VOICE })}>
        말로 하기
      </button>
      <button type="button" onClick={() => dispatch({ type: EVENTS.GO_HOME })}>
        처음으로
      </button>
    </section>
  )
}
