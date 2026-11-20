// 노선 표시 하나 (디자인 문서 3-6절, 9-1절 R6, 시안 route-guide-final.html 의 mark).
//   circle  번호 있는 지하철: 원 안에 번호. 테두리는 노선색
//   bus     버스: 둥근 네모 안에 번호만. 테두리는 버스 종류 색
//   tag     번호 없는 노선(공항철도 등): 흰 바탕 + 왼쪽 회색 막대 (노선 ID 가 올 때까지, R6)
// 모두 흰 바탕 + 검정 글씨. 노선색 위에 글자를 올리지 않는다. 색은 view/routeView.js 가 고른 토큰 이름만 쓴다
//
// props: leg (routeView 의 타는 구간: { mark, text, color })

import './LineMark.css'

const CLASS_OF = { circle: 'is-circle', bus: 'is-bus', tag: 'is-tag' }

export default function LineMark({ leg }) {
  const style = leg.mark === 'tag' ? undefined : { '--c': `var(${leg.color})` }
  return (
    <span className={`line-mark ${CLASS_OF[leg.mark] ?? CLASS_OF.circle}`} style={style}>
      {leg.text}
    </span>
  )
}
