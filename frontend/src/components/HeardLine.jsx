// 들은 말 한 줄: 들은 말: “병원” (36px, 따옴표 안만 굵게). CONFIRMING 과 REASKING 이 같은 모양을 쓴다 (디자인 문서 11-2절, 12-2절).
// text 가 비었거나 공백뿐이면(10초 무발화) 아무것도 그리지 않는다.
// 줄을 바꿀 때는 고르게 나눈다 (10-2절 긴 글 규칙, view/textWrap.js).
// lineRef: 몇 줄인지 재려는 쪽(REASKING, hooks/useLineCount.js)이 넘기는 ref

import { evenWrapClass } from '../view/textWrap.js'
import './HeardLine.css'

export default function HeardLine({ text, lineRef = null }) {
  const heard = typeof text === 'string' ? text.trim() : ''
  if (!heard) return null
  return (
    <p ref={lineRef} className={`heard-line ${evenWrapClass(heard)}`}>
      들은 말: “<b>{heard}</b>”
    </p>
  )
}
