// 소요 시간과 도착 시각 (경로 카드·요약 판이 함께 쓴다, 시안 route-guide-final.html 의 .card-time, .card-arrive).
// 도착 시각 = 지금 시각 + 소요 시간 (view/routeView.js arriveAt). 소요 시간을 모르면 둘 다 그리지 않는다
// 이 파일은 RouteCard.jsx 의 일부라 모양은 RouteCard.css 에 있다

import { useNow } from '../hooks/useNow.js'
import { arriveAt, clockText } from '../view/routeView.js'

export function RouteTime({ route }) {
  if (route.durationMin === null) return <span className="route-card-time" />
  return (
    <span className="route-card-time">
      약<b>{route.durationMin}</b>분
    </span>
  )
}

export function RouteArrive({ route }) {
  const now = useNow()
  const at = arriveAt(route, now)
  return <span className="route-card-arrive">{at ? `${clockText(at)} 도착` : ''}</span>
}
