// 큰 글씨가 정한 너비를 넘으면 단계씩 줄인다 (디자인 문서 10-2절 기다림 큰 글씨, 7절 IDLE 띠 이름. 계획서 2-4절).
// 시안 wait-final.html 의 글씨 줄이기를 옮겼다. 값(시작·최소·단계·너비)은 CSS 토큰 이름으로 받아서 화면 파일에 숫자가 없다.
//
// 쓰는 법
//   const ref = useFitText(text, { start: '--font-wait', min: '--font-wait-min', step: '--font-wait-step', max: '--wait-text-max' })
//   <h1 ref={ref}>{text}</h1>        글씨 크기는 이 훅이 style.fontSize 로 넣는다. 고른 크기는 data-size 에 남긴다
//
// 글꼴을 다 읽기 전에 재면 틀리므로 document.fonts.ready 뒤에 한 번 더 잰다 (계획서 6-2절)

import { useLayoutEffect, useRef } from 'react'
import { fitSize } from '../view/fitText.js'

function readPx(el, name) {
  return parseFloat(getComputedStyle(el).getPropertyValue(name))
}

export function useFitText(text, tokens) {
  const ref = useRef(null)
  const { start, min, step, max } = tokens

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    let cancelled = false
    const fit = () => {
      if (cancelled) return
      el.style.fontSize = ''
      const limit = readPx(el, max)
      const size = fitSize({
        start: readPx(el, start),
        min: readPx(el, min),
        step: readPx(el, step),
        fits: (s) => {
          el.style.fontSize = `${s}px`
          return el.scrollWidth <= limit
        },
      })
      el.style.fontSize = `${size}px`
      el.dataset.size = String(size)
    }
    fit()
    document.fonts?.ready.then(fit)
    return () => {
      cancelled = true
    }
  }, [text, start, min, step, max])

  return ref
}
