// 큰 글씨가 정한 너비를 넘으면 단계씩 줄인다 (디자인 문서 10-2절 기다림 큰 글씨, 7절 IDLE 띠 이름. 계획서 2-4절).
// 시안 wait-final.html 의 글씨 줄이기를 옮겼다. 값(시작·최소·단계·너비)은 CSS 토큰 이름으로 받아서 화면 파일에 숫자가 없다.
//
// 쓰는 법
//   const ref = useFitText(text, { start: '--font-wait', min: '--font-wait-min', step: '--font-wait-step', max: '--wait-text-max' })
//   <h1 ref={ref}>{text}</h1>        글씨 크기는 이 훅이 style.fontSize 로 넣는다. 고른 크기는 data-size 에 남긴다
//
// wrapAtMin (기본 false)
//   true  최소 크기로도 넘치면 요소에 data-wrap 을 붙인다. 쓰는 쪽 CSS 가 data-wrap 일 때 줄 바꿈을 허락한다
//         (기다림 큰 글씨: 72px 에서 고르게 최대 3줄, 10-2절 긴 글 규칙. 줄 바꿈 모양은 view/textWrap.js)
//   false 최소 크기에서 멈추고 한 줄로 둔다 (7단계 IDLE 띠 이름: 7절 규칙 1 "이름은 항상 한 줄")
//   재는 동안에는 data-wrap 을 떼서 한 줄 너비로 잰다. 그래서 쓰는 쪽 CSS 는 기본이 white-space: nowrap 이어야 한다
//
// maxPx (선택)
//   너비 한계를 토큰 대신 숫자로 받는다. 큰 띠 이름처럼 한계가 측정으로 정해질 때 쓴다 (PlaceBand: 좌우 요소에서 40px).
//   max 토큰도 maxPx 도 없으면(null) 아직 한계를 모르는 것이라 재지 않는다
// onFit (선택)
//   다 잰 뒤 { size, overflow, el } 로 부른다. 큰 띠는 이것으로 이름 상자 너비를 읽어 버스 번호·좌우 요소를 숨길지 정한다
//
// 글꼴을 다 읽기 전에 재면 틀리므로 document.fonts.ready 뒤에 한 번 더 잰다 (계획서 6-2절)

import { useLayoutEffect, useRef } from 'react'
import { fitSize } from '../view/fitText.js'

function readPx(el, name) {
  return parseFloat(getComputedStyle(el).getPropertyValue(name))
}

export function useFitText(text, tokens) {
  const ref = useRef(null)
  const { start, min, step, max, maxPx = null, wrapAtMin = false, onFit = null } = tokens
  const onFitRef = useRef(onFit)
  useLayoutEffect(() => {
    onFitRef.current = onFit
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || (!max && maxPx === null)) return undefined
    let cancelled = false
    const fit = () => {
      if (cancelled) return
      el.style.fontSize = ''
      delete el.dataset.wrap
      const limit = maxPx ?? readPx(el, max)
      const fits = (s) => {
        el.style.fontSize = `${s}px`
        return el.scrollWidth <= limit
      }
      const size = fitSize({ start: readPx(el, start), min: readPx(el, min), step: readPx(el, step), fits })
      const overflow = !fits(size)
      el.dataset.size = String(size)
      if (wrapAtMin && overflow) el.dataset.wrap = 'true'
      onFitRef.current?.({ size, overflow, el })
    }
    fit()
    document.fonts?.ready.then(fit)
    return () => {
      cancelled = true
    }
  }, [text, start, min, step, max, maxPx, wrapAtMin])

  return ref
}
