// 요약 판 (경로가 1개일 때, 디자인 문서 9-1절 R3, 시안 route-guide-final.html 의 .card.is-only).
// 고를 것이 없으니 버튼이 아니다. 묶음 바탕, 테두리 없음, 소요 시간은 카드처럼 크게, 도착 시각을 늘 보인다.
// 높이는 내용을 따른다 (탈것이 4개 이상이어도 노선 줄을 모두 보인다). QR_HANDOFF 도 이것을 쓴다 (10단계)
//
// props: route (routeView 의 경로 하나)

import RouteLines from './RouteLines.jsx'
import { RouteArrive, RouteTime } from './RouteArrive.jsx'
import './RouteCard.css'

export default function RouteSummary({ route }) {
  return (
    <div className="route-card is-only">
      <RouteTime route={route} />
      <RouteLines route={route} />
      <RouteArrive route={route} />
    </div>
  )
}
