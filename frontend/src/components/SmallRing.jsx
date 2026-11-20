// 작은 고리: MANUAL_SELECT 목록을 불러오는 중 (디자인 문서 12-4절, 시안 states.css .ring-small).
// 고리 부품(Ring)의 반지름을 절반으로(바깥 지름 152), 선 굵기는 그대로. 바깥 고리 위를 주 색 호가 --motion-wait 에 한 바퀴 돈다.
// 가운데 그림은 없다. 움직임 줄이기에서는 호가 멈춘다 (CSS). 크기는 모두 SmallRing.css 에 있다

import './SmallRing.css'

// 호의 길이는 둘레를 100 으로 친 값(pathLength). 도는 호 22% 는 CSS 에 있다
const ARC_FULL = 100

export default function SmallRing() {
  return (
    <svg className="small-ring" aria-hidden="true" focusable="false">
      <circle className="small-ring-halo" />
      <circle className="ring-arc small-ring-arc" pathLength={ARC_FULL} />
      <circle className="small-ring-core" />
    </svg>
  )
}
