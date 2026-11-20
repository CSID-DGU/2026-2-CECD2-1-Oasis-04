// 듣는 중 표시: 고리 둘레의 막대 40개가 음량에 따라 바깥으로 길어지고 진해진다 (디자인 문서 3-5절 '듣는 중 표시의 모양',
// 시안 listening-final.html 의 막대 스크립트). 가운데에는 children(고리)을 겹쳐 둔다.
//
// 음량: 지금은 시안과 같은 가짜 음량(fakeVoice)이다. 12단계에서 녹음기의 음량 알림(onLevel)으로 바꾼다 (계획서 3절 12단계).
// 막대는 매 프레임 바뀌므로 React 로 다시 그리지 않고, 처음 한 번 만든 <line> 의 속성만 고친다 (requestAnimationFrame).
// 움직임 줄이기 설정에서는 시안 ?freeze=0.6 과 같은 한 장으로 멈춘다. 상태는 "듣고 있어요" 글자가 알린다.
// 가장 빠른 출렁임이 1초에 약 1.7번이라 깜빡임 한도(1초 3번)보다 느리다.

import { useLayoutEffect, useRef } from 'react'
import './VoiceMeter.css'

const COUNT = 40 // 막대 수
const FAINT = 0.35 // 조용할 때 파랑이 남는 비율 (3-5절). 클 때는 1
const STILL_AT = 0.6 // 멈춘 그림의 시각(초). 시안 스크린샷(?freeze=0.6)과 같다. 움직일 때도 이 시각부터 시작한다

// 가짜 음량 (0~1): 말 한 마디(약 2.6초)마다 커졌다 잦아들고, 그 안에서 천천히 출렁인다 (시안 voice() 그대로)
function fakeVoice(t) {
  const phrase = Math.max(0, Math.sin((Math.PI * 2 * t) / 2.6)) ** 0.55
  return phrase * (0.8 + 0.2 * Math.sin(Math.PI * 2 * 0.9 * t - 1.8))
}

const cssPx = (el, name) => parseFloat(getComputedStyle(el).getPropertyValue(name))

export default function VoiceMeter({ children }) {
  const boxRef = useRef(null)
  const svgRef = useRef(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    const svg = svgRef.current
    // 크기는 CSS 변수에서 읽는다 (VoiceMeter.css). 막대는 바깥 고리 + 틈에서 시작해 최대 reach 만큼 길어진다
    const half = cssPx(box, '--meter-size') / 2
    const inner = cssPx(box, '--halo-r') + cssPx(box, '--bar-gap')
    const reach = cssPx(box, '--bar-reach')
    svg.setAttribute('viewBox', `${-half} ${-half} ${half * 2} ${half * 2}`)

    const NS = 'http://www.w3.org/2000/svg'
    const group = svg.querySelector('g')
    group.replaceChildren()
    const bars = Array.from({ length: COUNT }, (_, i) => {
      const line = document.createElementNS(NS, 'line')
      group.append(line)
      const angle = (i / COUNT) * Math.PI * 2 - Math.PI / 2
      return { line, cos: Math.cos(angle), sin: Math.sin(angle), side: Math.min(i, COUNT - i) } // side: 좌우가 같은 모양이 되게
    })

    const draw = (t) => {
      const level = fakeVoice(t)
      for (const { line, cos, sin, side } of bars) {
        const wobble = 0.6 + 0.4 * Math.sin(side * 1.9 + t * 5.3) * Math.sin(side * 0.7 - t * 3.1)
        const amount = 0.06 + 0.94 * level * wobble // 조용할 때도 점이 조금 길쭉하게 남는다
        line.setAttribute('x1', (cos * inner).toFixed(1))
        line.setAttribute('y1', (sin * inner).toFixed(1))
        line.setAttribute('x2', (cos * (inner + reach * amount)).toFixed(1))
        line.setAttribute('y2', (sin * (inner + reach * amount)).toFixed(1))
        line.setAttribute('stroke-opacity', (FAINT + (1 - FAINT) * amount).toFixed(2))
      }
    }

    draw(STILL_AT)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    let frame = 0
    const start = performance.now()
    const loop = (now) => {
      draw(STILL_AT + (now - start) / 1000)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="voice-meter" ref={boxRef}>
      <svg className="voice-meter-bars" ref={svgRef} aria-hidden="true" focusable="false">
        <g />
      </svg>
      <div className="voice-meter-center">{children}</div>
    </div>
  )
}
