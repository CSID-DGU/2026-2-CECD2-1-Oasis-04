// 무대(Stage): 화면을 항상 1920×1080 크기로 그리고, 창 크기에 맞춰 통째로 줄이거나 키운다 (디자인 문서 1절).
// 반응형을 만들지 않으려고 둔다. 화면(screens/*.jsx)은 창 크기를 신경 쓰지 않고 1920×1080 하나만 보고 만들면 된다.
//
// 하는 일
//   1. 무대 밖 상자(창 전체)의 크기가 바뀔 때마다 배율을 다시 구한다:
//      가로·세로 중 더 많이 줄여야 하는 쪽에 맞춘다 (잘리지 않게)
//   2. 무대를 창 가운데에 놓는다. 남는 자리는 무대 밖 바탕색으로 채운다 (세로 창이면 위아래, 넓은 창이면 좌우)
// 크기와 배율은 CSS 변수로 넘기고, 모양은 global.css 의 .stage-outside / .stage 가 맡는다.
//
// Spring 에 빗대면: 모든 화면에 공통으로 걸리는 필터(인터셉터) 같은 것이다. 화면 컴포넌트는 이 안에서 그려진다는 것을 모른다.

import { useEffect, useRef, useState } from 'react'

// 무대 크기 (px). 디자인 문서 1절의 캔버스와 같은 값이다. 바꿀 때는 문서부터 고친다
const STAGE_WIDTH = 1920
const STAGE_HEIGHT = 1080

/** 주어진 크기 안에 무대가 잘리지 않고 들어가는 배율 */
function stageScale(width, height) {
  return Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT)
}

export default function Stage({ children }) {
  const outsideRef = useRef(null)
  const [scale, setScale] = useState(() => stageScale(window.innerWidth, window.innerHeight))

  useEffect(() => {
    const outside = outsideRef.current
    const measure = () => {
      // 무대 밖 상자가 실제로 차지한 크기를 잰다. 아직 크기가 없으면(테스트 환경) 창 크기를 쓴다
      const width = outside.clientWidth || window.innerWidth
      const height = outside.clientHeight || window.innerHeight
      setScale(stageScale(width, height))
    }
    measure()

    // ResizeObserver: 상자 크기가 바뀌면 알려 준다. 창의 resize 이벤트보다 빠짐없이 온다.
    // 없는 환경(테스트의 jsdom)에서는 창의 resize 이벤트로 대신한다
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(outside)
    // 화면이 사라질 때(StrictMode 1차 실행 뒤 포함) 반드시 떼어 낸다
    return () => observer.disconnect()
  }, [])

  return (
    <div className="stage-outside" ref={outsideRef}>
      <div
        className="stage"
        style={{
          '--stage-width': `${STAGE_WIDTH}px`,
          '--stage-height': `${STAGE_HEIGHT}px`,
          '--stage-scale': scale,
        }}
      >
        {children}
      </div>
    </div>
  )
}
