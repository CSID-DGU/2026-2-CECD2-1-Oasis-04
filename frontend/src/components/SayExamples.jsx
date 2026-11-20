// 예시 문구: "이렇게 말해 보세요"(30px) + 따옴표 글자(52px). IDLE(세 줄, 7단계)과 REASKING(한 줄)이 쓴다
// (디자인 문서 8-2절, 12-2절, 시안 states.css .say-label .says).
//
// props
//   examples  예시 문장 배열 (따옴표 없이 넘긴다)

import './SayExamples.css'

export default function SayExamples({ examples }) {
  if (!examples?.length) return null
  return (
    <>
      <p className="say-label">이렇게 말해 보세요</p>
      <ul className="says">
        {examples.map((example) => (
          <li key={example}>“{example}”</li>
        ))}
      </ul>
    </>
  )
}
