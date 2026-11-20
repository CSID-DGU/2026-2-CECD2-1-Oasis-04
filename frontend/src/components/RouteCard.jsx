// 경로 카드 (경로가 2~3개일 때, 디자인 문서 9-1절 R3·R5, 3-2절 선택 표시, 시안 route-guide-final.html 의 .card).
// 체크 자리 | 소요 시간(+ 고른 카드만 도착 시각) | 노선 줄. 누르면 그 경로를 고른다 (화면 안 동작, 이벤트 없음).
//
// props
//   route     routeView 의 경로 하나
//   selected  고른 카드인지 (aria-pressed, 체크 표시, 도착 시각)
//   onSelect  누르면 부른다

import Icon from './Icon.jsx'
import RouteLines from './RouteLines.jsx'
import { RouteArrive, RouteTime } from './RouteArrive.jsx'
import './RouteCard.css'

export default function RouteCard({ route, selected, onSelect }) {
  return (
    <button type="button" className="route-card" aria-pressed={selected} onClick={onSelect}>
      <Icon name="check" className="route-card-check" />
      <RouteTime route={route} />
      <RouteLines route={route} />
      {selected && <RouteArrive route={route} />}
    </button>
  )
}
