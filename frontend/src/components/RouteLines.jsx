// 카드·요약 판의 노선 줄 (디자인 문서 9-1절 R5, 시안 route-guide-final.html 의 linesOf).
// 탈것마다 노선 표시를 화살표로 잇는다. 화살표는 다음 탈것과 한 덩어리라 줄이 바뀌어도 줄 끝에 화살표만 남지 않는다.
// 걸어서만 가는 경로는 "걸어서" (R4). 줄을 몇 줄로 접을지는 CSS(flex-wrap)가 칸 너비를 보고 정하고,
// 그려진 줄 수는 data-rows 에 남긴다 (화면 비교 스크립트가 시안의 checkCards 결과와 견준다).
//
// props: route (routeView 의 경로 하나)

import { useLayoutEffect, useRef } from 'react'
import Icon from './Icon.jsx'
import LineMark from './LineMark.jsx'
import './RouteLines.css'

export default function RouteLines({ route }) {
  const ref = useRef(null)

  // 그려진 줄 수 (줄마다 위쪽 끝이 다르다). 표시에는 쓰지 않는다
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const tops = new Set([...el.children].map((child) => child.offsetTop))
    el.dataset.rows = String(tops.size)
  })

  return (
    <span className="route-lines" ref={ref}>
      {route.walkOnly ? (
        <span className="route-lines-walk">걸어서</span>
      ) : (
        route.rides.map((leg, i) => (
          <span key={i} className="route-lines-step">
            {i > 0 && <Icon name="route_arrow" className="route-lines-arrow" />}
            <LineMark leg={leg} />
          </span>
        ))
      )}
    </span>
  )
}
