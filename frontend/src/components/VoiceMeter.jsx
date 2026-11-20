// 듣는 중 표시: 고리 둘레의 막대 40개가 음량에 따라 바깥으로 길어지고 진해진다 (디자인 문서 3-5절 '듣는 중 표시의 모양',
// 시안 listening-final.html 의 막대 스크립트). 가운데에는 children(고리)을 겹쳐 둔다.
//
// 음량: readLevel() 이 돌려주는 녹음기 음량(RMS 0~1, 옮기기 계획 12단계). real 은 녹음 중인 마이크 스트림의 analyser,
// mock 은 가짜 음량(DevPanel 에서 끄기·조용함·큰 소리). null 이면 잴 수 없다는 뜻이고 시안의 멈춘 모양(?freeze=0.6)을 보인다.
// 음량 → 막대 길이는 view/voiceLevel.js 의 순수 함수(잡음 무시, 빨리 올라가고 천천히 내려옴, 최대값)가 한다.
// 막대는 매 프레임 바뀌므로 React 상태로 넣지 않는다. requestAnimationFrame 에서 처음 한 번 만든 <line> 의 속성만 고친다.
// 화면을 떠나면(언마운트) 프레임 반복을 멈춘다. 음량 측정 장치는 녹음기가 LISTENING 을 떠날 때 함께 닫는다.
// 움직임 줄이기 설정에서는 시안 ?freeze=0.6 과 같은 한 장으로 멈춘다. 상태는 "듣고 있어요" 글자가 알린다.

import { useLayoutEffect, useRef } from 'react'
import { STILL_AT, barAmount, fakeVoice, followLevel, rmsToLevel } from '../view/voiceLevel.js'
import './VoiceMeter.css'

const COUNT = 40 // 막대 수
const FAINT = 0.35 // 조용할 때 파랑이 남는 비율 (3-5절). 클 때는 1

const cssPx = (el, name) => parseFloat(getComputedStyle(el).getPropertyValue(name))

// 음량을 읽다가 오류가 나도 화면은 멈춘 모양으로 둔다
const safeRead = (readLevel) => {
  try {
    const v = readLevel?.()
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

export default function VoiceMeter({ children, readLevel = null }) {
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

    const draw = (level, t) => {
      for (const { line, cos, sin, side } of bars) {
        const amount = barAmount(level, side, t)
        line.setAttribute('x1', (cos * inner).toFixed(1))
        line.setAttribute('y1', (sin * inner).toFixed(1))
        line.setAttribute('x2', (cos * (inner + reach * amount)).toFixed(1))
        line.setAttribute('y2', (sin * (inner + reach * amount)).toFixed(1))
        line.setAttribute('stroke-opacity', (FAINT + (1 - FAINT) * amount).toFixed(2))
      }
    }
    const drawStill = () => draw(fakeVoice(STILL_AT), STILL_AT)

    drawStill()
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    let frame = 0
    let level = 0 // 부드럽게 만든 음량 (0~1)
    let still = true // 지금 멈춘 모양인지. 잴 수 없는 동안 같은 그림을 다시 그리지 않으려고
    let last = performance.now()
    const start = last
    const loop = (now) => {
      const rms = safeRead(readLevel)
      if (rms === null) {
        if (!still) drawStill()
        still = true
        level = 0
      } else {
        level = followLevel(level, rmsToLevel(rms), now - last)
        still = false
        draw(level, STILL_AT + (now - start) / 1000)
      }
      last = now
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [readLevel]) // readLevel 은 녹음기 모듈 함수라 바뀌지 않는다

  return (
    <div className="voice-meter" ref={boxRef}>
      <svg className="voice-meter-bars" ref={svgRef} aria-hidden="true" focusable="false">
        <g />
      </svg>
      <div className="voice-meter-center">{children}</div>
    </div>
  )
}
