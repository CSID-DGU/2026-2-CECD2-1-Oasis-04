// 첫 화면(IDLE, IDLE_REDUCED)의 틀: 큰 띠 + 왼쪽 질문 묶음 + 오른쪽 큰 버튼 묶음
// (디자인 문서 8-1·8-2절, 시안 idle-final.css 의 .v8-left .v8-actions).
//   큰 띠     PlaceBand. 장소는 LocationContext 에서 읽는다
//   오른쪽    버튼 묶음 (IdleButtons). 너비 740, 오른쪽 여백 48, 본문의 세로 가운데
//   왼쪽      질문 묶음 (left). x 140 에서 시작하고 세로 가운데를 버튼 묶음과 맞춘다
//
// props
//   left     왼쪽 질문 묶음
//   actions  오른쪽 버튼 묶음
//   voice    false 면 버튼 하나(IDLE_REDUCED) 높이로 세로 가운데를 다시 잡는다

import PlaceBand from './PlaceBand.jsx'
import { useLocation } from '../state/LocationContext.jsx'
import './IdleFrame.css'

export default function IdleFrame({ left, actions, voice = true }) {
  const { location } = useLocation()
  const place = location?.place ?? null
  return (
    <section className={voice ? 'idle' : 'idle is-reduced'}>
      {/* 장소가 바뀌면 띠를 새로 그린다 (측정 결과가 이전 장소의 것으로 남지 않게) */}
      <PlaceBand key={JSON.stringify(place)} place={place} />
      <main className="idle-left">
        <div>{left}</div>
      </main>
      <div className="idle-right">{actions}</div>
    </section>
  )
}
