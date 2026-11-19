// 큰 고리 묶음: REASKING, UNAVAILABLE 의 왼쪽 칸 (디자인 문서 12-1절, 시안 states.css .stack .stack-title .core-line .core-more).
// LISTENING 과 같은 자리·크기의 고리(왼쪽 칸 가운데 축 x 460, 고리 가운데 y 495) 아래에 글을 한 덩어리로 가운데 정렬(폭 640):
//   제목(36px 보통) → 핵심 줄(72px 굵게) → children (들은 말, 예시, 나머지 문장)
// 핵심 줄은 줄을 바꿀 때 고르게 나눈다 (10-2절 긴 글 규칙, view/textWrap.js). 말줄임표는 쓰지 않는다.
//
// props
//   ring       Ring props ({ tone, icon })
//   title      제목 (화면 제목, h1)
//   core       핵심 줄
//   coreError  true 면 핵심 줄만 오류 색 (UNAVAILABLE 의 이유 첫 문장)
//   children   핵심 줄 아래

import Ring from './Ring.jsx'
import { evenWrapClass } from '../view/textWrap.js'
import './RingStack.css'

export default function RingStack({ ring, title, core, coreError = false, children = null }) {
  return (
    <div className="ring-stack">
      <div className="ring-stack-ring">
        <Ring {...ring} />
      </div>
      <h1 className="ring-stack-title">{title}</h1>
      <p className={`ring-stack-core ${evenWrapClass(core)} ${coreError ? 'is-error' : ''}`.trim()}>{core}</p>
      {children}
    </div>
  )
}
