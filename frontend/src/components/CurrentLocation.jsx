// 첫 화면(IDLE, IDLE_REDUCED)에 '지금 계신 곳' 한 줄을 보여 준다. 7단계에서 큰 띠(PlaceBand)로 바뀌면 지운다.
//
// 위치 조회는 state/LocationContext.jsx 로 옮겼다 (계획서 4-2절, 2단계). 여기서는 그 결과를 읽기만 한다.
// 조회 때·실패 처리는 예전과 같다: 처음 화면에 들어갈 때마다 다시 확인하고, 실패해도 이벤트를 dispatch 하지 않는다.
// 위치를 받지 못해 서버 설정의 고정 위치를 쓰게 되면 그 사실을 작은 글씨로 함께 알린다 (옮겨 다니며 시험할 때 확인용).

import { useLocation } from '../state/LocationContext.jsx'

const FALLBACK_HINT = {
  PERMISSION_DENIED: '위치 사용이 꺼져 있어서 미리 정해 둔 곳으로 안내해요',
  LOW_ACCURACY: '위치가 정확하지 않아서 미리 정해 둔 곳으로 안내해요',
  OUT_OF_AREA: '안내할 수 있는 지역 밖이라 미리 정해 둔 곳으로 안내해요',
}
const DEFAULT_FALLBACK_HINT = '위치를 확인하지 못해서 미리 정해 둔 곳으로 안내해요'

export default function CurrentLocation() {
  const { location, status } = useLocation()

  if (status === 'loading') return <p className="location">지금 계신 곳을 확인하고 있어요</p>
  if (!location?.text) return null

  const { text, source, reason } = location
  return (
    <>
      <p className="location">{text}</p>
      {source !== 'GPS' && reason && <p className="hint">{FALLBACK_HINT[reason] ?? DEFAULT_FALLBACK_HINT}</p>}
    </>
  )
}
