// 고리: 바깥 옅은 원 + 안쪽 원 + 가운데 그림 (디자인 문서 3-4절, 시안 shared/flow.css .ring-*).
// LISTENING 의 듣는 중 표시, 기다림 화면 5개, REASKING, UNAVAILABLE 이 같은 모양을 쓴다.
//
// props
//   tone      'primary'(주 색. LISTENING·기다림), 'soft'(REASKING: 안쪽 고리도 35%), 'text'(UNAVAILABLE: 본문색 고리)
//   icon      가운데 그림 (RingIcon 이름: mic, flag, bubble, logo, walk, pin, clock)
//   children  그림 대신 가운데에 둘 것 (CHECKING 의 남은 초)
//   arc       'none'(LISTENING)
//             'spin'      기다림 4개: 바깥 고리 위를 주 색 호가 --motion-wait 에 한 바퀴. 움직임 줄이기에서 멈춘다 (CSS)
//             'countdown' CHECKING: 돌지 않고 남은 시간만큼 줄어든다 (디자인 문서 10-2·10-3절)
//   progress  countdown 일 때 남은 비율 0~1
//
// 크기는 모두 CSS 토큰(--halo-r, --ring-r, --ring-width, --ring-icon, --arc-width)에서 온다. 원은 CSS 의 r·cx·cy 로 그리고,
// 가운데 그림은 SVG 안이 아니라 위에 겹친 HTML 이라 x·y 속성이 필요 없다 (계획서 2-A-4절 placeRingIcons 문제)

import RingIcon from './RingIcon.jsx'
import './Ring.css'

// 호의 길이는 둘레를 100 으로 친 값(pathLength)으로 적는다. 도는 호의 길이(22%)는 Ring.css 에 있다
const ARC_FULL = 100

function countdownDash(progress) {
  const p = Math.max(0, Math.min(1, progress))
  return { strokeDasharray: `${(p * ARC_FULL).toFixed(2)} ${ARC_FULL}` }
}

export default function Ring({ tone = 'primary', icon = null, children = null, arc = 'none', progress = 1, className = '' }) {
  return (
    <div className={`ring is-${tone} ${className}`.trim()}>
      <svg className="ring-circles" aria-hidden="true" focusable="false">
        <circle className="ring-halo" />
        {arc !== 'none' && (
          <circle
            className={`ring-arc ${arc === 'spin' ? 'is-spinning' : ''}`.trim()}
            pathLength={ARC_FULL}
            style={arc === 'countdown' ? countdownDash(progress) : undefined}
          />
        )}
        <circle className="ring-core" />
      </svg>
      <div className="ring-center">{children ?? (icon && <RingIcon name={icon} />)}</div>
    </div>
  )
}
