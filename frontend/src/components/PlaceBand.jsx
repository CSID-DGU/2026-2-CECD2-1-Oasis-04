// 큰 띠 (역명판): 첫 화면(IDLE, IDLE_REDUCED)의 위쪽 337px. "지금 계신 곳" 표시를 겸한다
// (디자인 문서 7절, 8-3·8-4절, 시안 design/mockups/confirmed/idle-band.js + idle-final.css 의 .v8-* .v9-*).
//
//   위쪽 줄   로고·서비스 이름, 날짜·시각. 얇은 띠(ThinBand)와 같은 부품·같은 자리라서 다음 화면으로 넘어갈 때 움직이지 않는다
//   이름 상자 화면 가운데 흰 상자. 이름은 한 줄, 112px 에서 72px 까지 8px 씩 줄인다 (useFitText)
//   줄       최대 3줄. 지하철은 노선 표시·앞 역 / 다음 역, 버스는 종류 / 번호. 선은 화면 끝까지 (규칙은 view/placeBand.js)
//            정류장에 앞·다음 정류장(place.prev·next)이 오면 첫 줄에 앞 정류장 / 다음 정류장을 그리고 버스 줄은 2줄까지
//   정보 없음 회색 선 세 줄과 "지금 계신 곳을 확인하고 있어요"
//
// props
//   place  장소 정보 (8-5절 형식) 또는 null
//
// 그리는 순서 (시안 renderBand 와 같다. 측정은 여기서, 정하는 것은 view/placeBand.js 의 순수 함수가 한다)
//   1. 줄을 그리고 좌우 요소의 끝과 버스 번호 후보의 너비를 잰다 → 이름 글자의 너비 한계
//   2. useFitText 가 그 한계 안에 들어가게 이름 글씨를 줄인다
//   3. 다 줄인 이름 상자 너비로 숨길 것(버스 번호 → 좌우 요소)과 버스 줄의 번호/개수를 정한다
//   4. 이름 상자 오른쪽 끝을 보고 선을 그린다 (종점은 상자 근처에서 끝난다)
// 숨기는 것은 visibility 로 숨긴다 (display: none 이면 다시 잴 때 너비가 0 이 되어 결과가 바뀐다).
// 정한 결과는 data-place-name 에 남긴다 (시안의 band.dataset.placeName 과 같은 모양, 화면 비교용)

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import Clock from './Clock.jsx'
import { useFitText } from '../hooks/useFitText.js'
import { SERVICE_NAME, LOGO_ICON } from '../brand.js'
import { displayPlaceName } from '../view/placeName.js'
import {
  BAND,
  WAITING_ROWS,
  bandRows,
  rowYs,
  lineShades,
  neutralShades,
  nameLimits,
  nameMaxWidth,
  decideHiding,
  chooseNumbers,
  choiceLabel,
  lineSegments,
} from '../view/placeBand.js'
import './ThinBand.css'
import './PlaceBand.css'

const WAITING_TEXT = '지금 계신 곳을 확인하고 있어요'
const EXAMPLE_NOTE = '버스 번호는 예시'

/** 띠 색 계산에 쓰는 토큰 값 (global.css :root) */
function readColorTokens(el) {
  const cs = getComputedStyle(el)
  const v = (name) => cs.getPropertyValue(name).trim()
  const n = (name, fallback) => parseFloat(v(name)) || fallback
  return {
    read: v,
    primary: v('--color-primary'),
    bgGroup: v('--color-bg-group'),
    none: v('--line-none'),
    textSub: v('--color-text-sub'),
    lineTint: n('--line-tint', 0.3),
    lineTintSoft: n('--line-tint-soft', 0.2),
    ringTint: n('--ring-tint', 0.6),
    ringTintSoft: n('--ring-tint-soft', 0.45),
  }
}

const shadesOf = (token, colors) => (token ? lineShades(colors.read(token), colors) : neutralShades(colors))

function Mark({ mark, colors }) {
  const ring = colors && mark.token ? shadesOf(mark.token, colors).ring : undefined
  if (mark.type === 'circle') return <span className="place-band-circle" style={{ '--c': ring }}>{mark.text}</span>
  if (mark.type === 'linetag') return <span className="place-band-tag place-band-linetag" style={{ '--c': ring }}>{mark.text}</span>
  return <span className="place-band-tag">{mark.text}</span>
}

function Choice({ choice }) {
  if (choice.text) return <span className="place-band-tag">{choice.text}</span>
  return choice.numbers.map((n) => (
    <span key={n} className="place-band-tag is-num">
      {n}
    </span>
  ))
}

export default function PlaceBand({ place }) {
  const rows = useMemo(() => bandRows(place), [place])
  const name = rows ? displayPlaceName(place) : ''
  const bandRef = useRef(null)
  const plateRef = useRef(null)
  const [measured, setMeasured] = useState(null) // 1단계 결과
  const [fit, setFit] = useState(null) // 3단계 결과
  const [fontsReady, setFontsReady] = useState(false)

  // 1. 좌우 요소와 번호 후보를 잰다. 글꼴을 다 읽은 뒤 한 번 더 (계획서 6-2절)
  useLayoutEffect(() => {
    const band = bandRef.current
    const plate = plateRef.current
    if (!band || !plate) return undefined
    let cancelled = false
    if (!fontsReady) document.fonts?.ready.then(() => !cancelled && setFontsReady(true))
    const all = (sel) => [...band.querySelectorAll(sel)]
    const plateStyle = getComputedStyle(plate)
    const next = {
      mid: plate.offsetTop + parseFloat(plateStyle.height) / 2, // offsetHeight 는 정수로 반올림된다 (229.44 → 229)
      lineWidth: parseFloat(getComputedStyle(band).getPropertyValue('--line-width')) || 14,
      lineEdge: parseFloat(getComputedStyle(band).getPropertyValue('--line-edge')) || 0, // 테두리가 있는 노선 선: 안쪽 선을 이만큼 가늘게
      colors: readColorTokens(band),
      plateMin: parseFloat(plateStyle.minWidth) || 0,
      platePad: parseFloat(plateStyle.paddingLeft) || 0,
      groupsRight: Math.max(0, ...all('.place-band-group').map((g) => g.offsetLeft + g.offsetWidth)),
      // 오른쪽 표지는 오른쪽 여백에 붙어 있다. 종점 표지는 나중에 자리를 옮기므로 너비로 계산한다 (시안은 옮기기 전에 잰다)
      rightTagsLeft: Math.min(BAND.WIDTH, ...all('[data-right]').map((t) => BAND.WIDTH - BAND.PAD - t.offsetWidth)),
      choiceWidths: (rows ?? []).map((row, i) => all(`.place-band-measure[data-row="${i}"] > .place-band-nums`).map((el) => el.offsetWidth)),
    }
    setMeasured(next)
    return () => {
      cancelled = true
    }
  }, [rows, fontsReady])

  const hasNumbers = Boolean(rows?.some((r) => r.choices))
  const limits = measured ? nameLimits({ groupsRight: measured.groupsRight, rightTagsLeft: measured.rightTagsLeft, hasNumbers }) : null
  const maxPx = rows && limits ? nameMaxWidth(limits.full, measured) : null

  // 3. 이름 글씨를 정한 뒤: 숨길 것, 버스 줄의 번호/개수
  const onFit = useCallback(
    ({ size }) => {
      const plate = plateRef.current
      if (!plate || !measured || !rows) return
      const plateWidth = parseFloat(getComputedStyle(plate).width) // 소수점까지 (offsetWidth 는 반올림)
      const plateRight = BAND.WIDTH / 2 + plateWidth / 2
      const hiding = decideHiding({ plateWidth, limits, hasNumbers })
      const choices = rows.map((row, i) =>
        row.choices && !hiding.numbersHidden ? chooseNumbers({ choiceWidths: measured.choiceWidths[i], plateRight }) : -1,
      )
      const next = { size, plateRight, ...hiding, choices }
      setFit((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    },
    [measured, rows, limits, hasNumbers],
  )

  // 2. 이름 글씨 줄이기 (7절 규칙 3). 한 줄 그대로 둔다 (wrapAtMin 없음, 규칙 1)
  const nameRef = useFitText(name, { start: '--place-name-size', min: '--place-name-min', step: '--place-name-step', maxPx, onFit })

  const count = rows ? rows.length : WAITING_ROWS
  const ys = measured ? rowYs(count, measured.mid) : []
  const marksShown = !fit?.marksHidden
  const segments = rows && fit ? lineSegments({ rows, ys, plateRight: fit.plateRight, marksShown }) : null

  const info = fit
    ? {
        size: fit.size,
        numbersHidden: fit.numbersHidden,
        marksHidden: fit.marksHidden,
        fits: fit.fits,
        busText: rows.flatMap((r, i) => (r.choices && !fit.numbersHidden && !fit.marksHidden ? [choiceLabel(fit.choices[i])] : [])),
      }
    : null

  const hide = (hidden) => (hidden ? { visibility: 'hidden' } : {})

  return (
    <header className="place-band" ref={bandRef} data-place-name={info ? JSON.stringify(info) : undefined}>
      {/* 선: 이름 상자 뒤로 화면 끝에서 끝까지 */}
      <svg className="place-band-lines" aria-hidden="true">
        {measured &&
          !rows &&
          ys.map((y) => <path key={y} d={`M0 ${y}H${BAND.WIDTH}`} stroke={measured.colors.none} style={{ strokeWidth: measured.lineWidth }} />)}
        {segments?.map((seg, i) => {
          const color = shadesOf(rows[i].token, measured.colors)
          const d = `M${seg.from} ${seg.y}H${seg.to}`
          const w = measured.lineWidth
          // 규칙 I: 옅은 색은 진한 테두리(위아래 3px)를 먼저 그리고 그 위에 선을 그린다
          return (
            <g key={i}>
              {color.edge && <path d={d} stroke={color.edge} strokeLinecap={seg.cap} style={{ strokeWidth: w }} />}
              <path d={d} stroke={color.band} strokeLinecap={seg.cap} style={{ strokeWidth: color.edge ? w - measured.lineEdge : w }} />
            </g>
          )
        })}
      </svg>

      {/* 위쪽 줄: 얇은 띠와 같은 부품·자리 */}
      <div className="thin-band place-band-top">
        <div className="thin-band-brand">
          <Icon name={LOGO_ICON} className="thin-band-logo" />
          <span>{SERVICE_NAME}</span>
        </div>
        <div className="place-band-note">{rows && place?.example ? EXAMPLE_NOTE : ''}</div>
        <Clock className="thin-band-now" />
      </div>

      <div className="place-band-plate" ref={plateRef}>
        {rows ? (
          <div className="place-band-name" ref={nameRef}>
            {name}
          </div>
        ) : (
          <div className="place-band-waiting">{WAITING_TEXT}</div>
        )}
      </div>

      {rows?.map((row, i) => {
        const top = { top: ys[i] ?? 0 }
        const seg = segments?.[i]
        return (
          <div key={i} className="place-band-row">
            <span className="place-band-group" style={{ ...top, ...hide(!marksShown) }}>
              {row.left.map((mark, j) => (
                <Mark key={j} mark={mark} colors={measured?.colors} />
              ))}
            </span>
            {row.right && (
              <span
                data-right=""
                className={seg?.endTagLeft != null ? 'place-band-tag place-band-end' : 'place-band-tag place-band-right'}
                style={{ ...top, ...(seg?.endTagLeft != null ? { left: seg.endTagLeft } : {}), ...hide(!marksShown) }}
              >
                {row.right}
              </span>
            )}
            {row.choices && fit && fit.choices[i] >= 0 && (
              <span className="place-band-nums" style={{ ...top, ...hide(fit.numbersHidden || !marksShown) }}>
                <Choice choice={row.choices[fit.choices[i]]} />
              </span>
            )}
            {/* 번호 후보의 너비를 재는 자리 (보이지 않는다) */}
            {row.choices && (
              <span className="place-band-measure" data-row={i} aria-hidden="true">
                {row.choices.map((choice, k) => (
                  <span key={k} className="place-band-nums">
                    <Choice choice={choice} />
                  </span>
                ))}
              </span>
            )}
          </div>
        )
      })}
    </header>
  )
}
