// 요소의 글이 지금 몇 줄로 그려졌는지 잰다 (높이 ÷ 줄 높이). REASKING 이 들은 말이 3줄이면 예시를 숨길 때 쓴다 (디자인 문서 12-2절).
// 글꼴을 다 읽기 전에 재면 틀리므로 document.fonts.ready 뒤에 한 번 더 잰다 (계획서 6-2절).
//
// 쓰는 법
//   const [ref, lines] = useLineCount(text)
//   <p ref={ref}>{text}</p>          요소가 없으면 lines 는 0

import { useLayoutEffect, useRef, useState } from 'react'

export function useLineCount(text) {
  const ref = useRef(null)
  const [lines, setLines] = useState(0)

  useLayoutEffect(() => {
    let cancelled = false
    const measure = () => {
      if (cancelled) return
      const el = ref.current
      if (!el) return setLines(0)
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight)
      const height = el.getBoundingClientRect().height
      setLines(lineHeight > 0 ? Math.round(height / lineHeight) : 1)
    }
    measure()
    document.fonts?.ready.then(measure)
    return () => {
      cancelled = true
    }
  }, [text])

  return [ref, lines]
}
