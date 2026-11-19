// 경로 타임라인 (디자인 문서 9-1절 R2·R4·R7·R8, 3-6절, 시안 route-guide-final.html 의 timelineOf, fitNames, drawRails, fitTimeline).
// 무엇을 그릴지(점·걷기·타기·접기 항목)는 view/routeView.js 가 단계마다 미리 만들어 둔다. 이 부품은 그려 보고 재서
//   ① 칸을 넘치면 어느 단계까지 줄일지 (view/routeFit.js 의 nextFit: 촘촘 → 걷기 한 줄 → 이름 36px → 가운데 접기)
//   ② 두 줄(또는 한 줄)을 넘는 정류장 이름을 36px 로
//   ③ 점과 점 사이의 선 (타는 구간은 노선색, 걷는 구간은 점선)
// 을 정한다. 잴 때는 무대 배율(Stage)과 상관없는 값(offset, scroll, 계산된 스타일)만 쓰고, 소수점까지 읽는다.
// 글꼴을 다 읽은 뒤 처음부터 한 번 더 잰다 (계획서 6-2절).
//
// props
//   route     routeView 의 경로 하나
//   fallback  환승 2회 이하 경로가 없어 하나만 보이는 경우 (R1. 넘치지 않아도 가운데를 접는다)
//   appear    true 면 나타나기(250ms, 3-5절). 카드를 눌러 바꿨을 때만

import { useLayoutEffect, useRef, useState } from 'react'
import LineMark from './LineMark.jsx'
import { FIT_START, TIMELINE_OF_LEVEL, nextFit, smallNames } from '../view/routeFit.js'
import './Timeline.css'

const START = { ...FIT_START, lines: null }

/** 정류장 이름: 점(.) 뒤에서만 줄을 바꾼다. 버스 정류장은 뒤에 작은 "정류장" */
function PlaceName({ place }) {
  const parts = String(place?.name ?? '').split('.')
  return parts.map((part, i) => (
    <span key={i}>
      {i > 0 && <wbr />}
      <span className="timeline-name-part">
        {part}
        {i < parts.length - 1 ? '.' : place?.kind === 'STOP' && <> <small>정류장</small></>}
      </span>
    </span>
  ))
}

const TONE_CLASS = { from: 'is-from', mid: 'is-mid', dest: 'is-dest', '': '' }

function Stop({ item, small }) {
  const cls = ['timeline-stop', TONE_CLASS[item.tone] ?? '', item.role ? '' : 'no-role'].filter(Boolean).join(' ')
  return (
    <li className={cls}>
      {item.role && <span className="timeline-role">{item.role}</span>}
      <span className="timeline-dot" />
      <span className="timeline-main">
        <span className={small ? 'timeline-name is-small' : 'timeline-name'}>
          <PlaceName place={item.place} />
        </span>
        {item.exit && (
          <span className="timeline-exit">
            <b>{item.exit}</b>번 출구
          </span>
        )}
      </span>
    </li>
  )
}

function Row({ item, small }) {
  if (item.type === 'stop') return <Stop item={item} small={small} />
  if (item.type === 'ride') {
    return (
      <li className="timeline-ride" data-color={item.leg.color}>
        <span className="timeline-ride-text">
          <LineMark leg={item.leg} />
          {item.leg.stopsText && <span className="timeline-count">{item.leg.stopsText}</span>}
        </span>
      </li>
    )
  }
  if (item.type === 'fold') {
    return (
      <li className="timeline-walk is-fold" data-to="stop">
        <span className="timeline-walk-text">
          <b>갈아타기 {item.more}번 더</b>
          <br />
          자세한 길은 휴대폰으로 보내 드려요
        </span>
      </li>
    )
  }
  return (
    <li className="timeline-walk" data-to={item.toStop ? 'stop' : 'ride'}>
      <span className="timeline-walk-text">{item.text}</span>
    </li>
  )
}

/** 요소의 위쪽 끝 (타임라인 기준, 소수점까지). offsetTop 은 정수로 반올림되므로 화면 좌표의 차이를 무대 배율로 나눈다 */
function topWithin(el, base, scale) {
  return (el.getBoundingClientRect().top - base.getBoundingClientRect().top) / scale
}

/** 무대 배율 (components/Stage.jsx 가 --stage-scale 로 넘긴다). 무대 밖(테스트)이면 1 */
function stageScale(el) {
  const stage = el.closest('.stage')
  return (stage && parseFloat(getComputedStyle(stage).getPropertyValue('--stage-scale'))) || 1
}

/** 선: 점과 점 사이. 걷는 구간은 점선, 타는 구간은 노선색. 앞이 걷기면 선 머리를 둥글게 (시안 drawRails) */
function measureRails(list) {
  const scale = stageScale(list)
  const gap = parseFloat(getComputedStyle(list).getPropertyValue('--rail-gap')) || 0
  const rows = [...list.children].filter((li) => !li.classList.contains('timeline-rails'))
  const dotY = (li) => {
    const dot = li.querySelector('.timeline-dot')
    return topWithin(dot, list, scale) + parseFloat(getComputedStyle(dot).height) / 2
  }
  const rails = []
  let y = 0
  let prevStop = false
  rows.forEach((li, i) => {
    if (li.classList.contains('timeline-stop')) {
      y = dotY(li)
      prevStop = true
      return
    }
    const isWalk = li.classList.contains('timeline-walk')
    const next = rows[i + 1]
    const start = y + (prevStop && isWalk ? gap : 0)
    const end = next?.classList.contains('timeline-stop')
      ? dotY(next) - (isWalk ? gap : 0)
      : topWithin(li, list, scale) + parseFloat(getComputedStyle(li).height)
    rails.push({ walk: isWalk, afterWalk: !prevStop, color: li.dataset.color ?? null, top: start, height: Math.max(0, end - start) })
    y = end
    prevStop = false
  })
  return rails
}

export default function Timeline({ route, fallback = false, appear = false }) {
  const ref = useRef(null)
  const [fit, setFit] = useState(START) // 줄이기 단계 + 이름 줄 수(lines)
  const [rails, setRails] = useState([])

  // 글꼴을 다 읽으면 처음부터 다시 잰다
  useLayoutEffect(() => {
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (!cancelled) setFit({ ...START })
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 그린 뒤 잰다: ① 이름 줄 수 → ② 넘치면 다음 단계 → ③ 더 할 것이 없으면 선
  useLayoutEffect(() => {
    const list = ref.current
    if (!list) return
    if (fit.lines === null) {
      // 이름 줄 수 (모두 48px 로 그린 상태). 줄 높이(--name-line)로 나눈다
      const lines = [...list.querySelectorAll('.timeline-name')].map((name) => {
        const cs = getComputedStyle(name)
        return Math.round(parseFloat(cs.height) / parseFloat(cs.lineHeight))
      })
      setFit((prev) => ({ ...prev, lines }))
      return
    }
    const overflow = list.scrollHeight > list.clientHeight + 1
    const next = nextFit(fit, { overflow, fallback, canFold: Boolean(route.timeline.folded) })
    if (next) {
      setFit({ ...next, lines: next.level === fit.level ? fit.lines : null })
      return
    }
    list.dataset.fit = JSON.stringify({ steps: fit.steps, overflow: overflow ? list.scrollHeight - list.clientHeight : 0 })
    setRails(measureRails(list))
  }, [fit, fallback, route])

  const items = route.timeline[TIMELINE_OF_LEVEL[fit.level]] ?? route.timeline.full
  const small = fit.lines === null ? [] : smallNames(fit.lines, fit.maxLines)
  // 항목마다 몇 번째 점인지 (이름 줄 수는 점 순서대로 잰다)
  const stopIndexes = items.map((item, i) => items.slice(0, i + 1).filter((it) => it.type === 'stop').length - 1)

  const cls = ['timeline', fit.compact ? 'is-compact' : '', appear ? 'is-appearing' : ''].filter(Boolean).join(' ')
  return (
    <ol className={cls} ref={ref}>
      {items.map((item, i) => (
        <Row key={i} item={item} small={item.type === 'stop' && Boolean(small[stopIndexes[i]])} />
      ))}
      <li className="timeline-rails" aria-hidden="true">
        {rails.map((r, i) => (
          <span
            key={i}
            className={['timeline-rail', r.walk ? 'is-walk' : '', !r.walk && r.afterWalk ? 'is-after-walk' : ''].filter(Boolean).join(' ')}
            style={{ '--c': r.color ? `var(${r.color})` : undefined, '--rail-top': `${r.top}px`, '--rail-height': `${r.height}px` }}
          />
        ))}
      </li>
    </ol>
  )
}
