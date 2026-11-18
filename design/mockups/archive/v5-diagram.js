// (build-v5.mjs 가 v4-diagram.js 에서 만든 파일. 직접 고치지 않는다)
// 노선 그림 부품 (시안, 가로 캔버스용). 장소 정보(window.PLACE)를 받아 .v5-diagram 안에 그림을 그린다.
// v4 와 그리는 방법은 같고 크기만 다르다: 왼쪽 칸 너비 1160, 높이 340.
//   지하철역     { type: 'SUBWAY_STATION', name, lines: [{ lineId, label, stationNo, prev, next }] }
//   버스정류장   { type: 'BUS_STOP', name, buses: [{ kind, numbers }], nearSubway: { name, lines: [{ lineId, label }] }, example }
//   정보 없음    null → 색 없는 기본 그림
// 색은 서버가 주지 않는다. lineId·kind 로 CSS 토큰(--line-…, --bus-…)을 찾는다 (문서 3-6절).
// 규칙: 띠는 가늘고 옅게, 띠 위에 글씨를 올리지 않는다, 번호는 흰 원 안에 검정 글씨.
// 실제 앱에서는 React 부품(<PlaceDiagram place={...} />)으로 옮긴다. 그리는 계산은 그대로 쓸 수 있다.

const W = 1160 // 그림 너비 (왼쪽 칸)
const H = 340 // 그림 높이
const BAND = 20 // 띠 굵기

const BUS_KINDS = {
  TRUNK: { name: '간선', token: '--bus-trunk' },
  BRANCH: { name: '지선', token: '--bus-branch' },
  EXPRESS: { name: '광역', token: '--bus-express' },
  CIRCULAR: { name: '순환', token: '--bus-circular' },
}

const css = getComputedStyle(document.documentElement)
const token = (name) => css.getPropertyValue(name).trim()
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** 색에 흰색을 섞는다. amount 는 원래 색이 남는 비율 (0~1). */
function tint(hex, amount) {
  return '#' + rgb(hex).map((c) => Math.round(255 + (c - 255) * amount).toString(16).padStart(2, '0')).join('')
}

/** 주 버튼 파랑과 비슷한 색인지. 비슷하면 더 옅게 쓴다 (1호선, 간선버스). */
function nearPrimary(hex) {
  const [a, b] = [rgb(hex), rgb(token('--color-primary'))]
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 70
}

/** 띠 색과 고리 색. 띠는 옅게, 고리는 띠보다 조금 진하게. */
function shades(tokenName) {
  const hex = token(tokenName)
  const soft = nearPrimary(hex)
  // 흐림 검사에서 광역버스 빨강 띠와 고리가 예시 문구보다 먼저 보여서 0.42/0.8 에서 낮췄다
  return { band: tint(hex, soft ? 0.2 : 0.3), ring: tint(hex, soft ? 0.45 : 0.6) }
}

const text = (x, y, value, cls = 'is-mid') => `<div class="t ${cls}" style="left:${x}px;top:${y}px">${value}</div>`

// ---------- 지하철역: 노선마다 가는 띠 하나. 가운데 흰 통에 역 번호, 왼쪽 원에 노선 번호, 오른쪽에 앞뒤 역 ----------
function drawSubway(place) {
  const lines = place.lines.slice(0, 4)
  const mid = (lines.length - 1) / 2
  let svg = ''
  let html = ''
  const hubX = 470
  const gap = Math.min(118, (H - 68) / Math.max(1, lines.length - 1))
  const rows = lines.map((line, i) => ({
    line,
    y: H / 2 + (i - mid) * gap, // 양 끝에서의 높이
    hubY: H / 2 + (i - mid) * gap * 0.68, // 갈아타는 역에서의 높이 (가운데로 모인다)
    ...shades(`--line-${line.lineId}`),
  }))

  rows.forEach(({ y, hubY, band }) => {
    const d = Math.abs(hubY - y)
    svg += `<path d="M76 ${y}H${290}L${290 + d} ${hubY}H${640}L${640 + d} ${y}H780" stroke="${band}" stroke-width="${BAND}" stroke-linejoin="round" />`
  })
  // 갈아타는 역: 세 노선을 잇는 흰 통
  const top = rows[0].hubY - 40
  const bottom = rows.at(-1).hubY + 40
  svg += `<rect x="${hubX - 56}" y="${top}" width="112" height="${bottom - top}" rx="40" fill="#fff" stroke="#111" stroke-width="4" />`

  rows.forEach(({ line, y, hubY, ring }) => {
    svg += `<circle cx="36" cy="${y}" r="31" fill="#fff" stroke="${ring}" stroke-width="7" />`
    html += text(36, y, line.label)
    html += text(hubX, hubY, line.stationNo)
    html += text(812, y, `${line.prev} ↔ ${line.next}`, 'is-left')
  })
  return { svg, html }
}

// ---------- 버스정류장: 버스 종류마다 가는 띠 하나, 그 위 흰 알약에 번호. 아래에 가까운 지하철 ----------
function drawBus(place) {
  const groups = place.buses.filter((g) => BUS_KINDS[g.kind]).slice(0, 4)
  const rowsHeight = 256
  const step = Math.min(88, rowsHeight / groups.length)
  const first = (rowsHeight - step * (groups.length - 1)) / 2
  let svg = ''
  let html = ''

  groups.forEach((group, i) => {
    const y = first + i * step
    const { band, ring } = shades(BUS_KINDS[group.kind].token)
    html += text(0, y, BUS_KINDS[group.kind].name, 'is-left')
    svg += `<path d="M96 ${y}H${W}" stroke="${band}" stroke-width="${BAND}" />`
    let x = 128
    const shown = group.numbers.slice(0, 4)
    shown.forEach((number) => {
      const width = 52 + String(number).length * 22
      svg += `<rect x="${x}" y="${y - 34}" width="${width}" height="68" rx="34" fill="#fff" stroke="${ring}" stroke-width="6" />`
      html += text(x + width / 2, y, number, 'is-mid is-bus')
      x += width + 22
    })
    if (group.numbers.length > shown.length) {
      const more = `외 ${group.numbers.length - shown.length}대`
      svg += `<rect x="${x}" y="${y - 30}" width="${more.length * 30 + 28}" height="60" fill="#fff" />`
      html += text(x + 14, y, more, 'is-left')
    }
  })

  // 가까운 지하철: 작게
  const near = place.nearSubway
  if (near) {
    const y = 304
    html += text(0, y, '가까운 지하철', 'is-left')
    let x = 232
    near.lines.slice(0, 4).forEach((line) => {
      const { ring } = shades(`--line-${line.lineId}`)
      svg += `<circle cx="${x}" cy="${y}" r="27" fill="#fff" stroke="${ring}" stroke-width="6" />`
      html += text(x, y, line.label)
      x += 68
    })
    html += text(x - 14, y, near.name, 'is-left')
  }
  if (place.example) html += `<div class="t is-left" style="right:0;top:304px">버스 번호는 예시</div>`
  return { svg, html }
}

// ---------- 기본 그림: 장소 정보가 없을 때. 색 없는 띠와 빈 역 ----------
function drawDefault() {
  const band = token('--color-secondary-pressed')
  const ys = [52, 170, 288]
  const hub = [90, 170, 250]
  let svg = ''
  ys.forEach((y, i) => {
    const d = Math.abs(hub[i] - y)
    svg += `<path d="M0 ${y}H${290}L${290 + d} ${hub[i]}H${760}L${760 + d} ${y}H${W}" stroke="${band}" stroke-width="${BAND}" stroke-linejoin="round" />`
  })
  svg += `<rect x="414" y="50" width="112" height="240" rx="40" fill="#fff" stroke="#111" stroke-width="4" />`
  hub.forEach((y) => (svg += `<circle cx="470" cy="${y}" r="14" fill="${band}" />`))
  ;[
    [130, 52],
    [1000, 52],
    [130, 170],
    [900, 170],
    [130, 288],
    [1040, 288],
  ].forEach(([x, y]) => (svg += `<circle cx="${x}" cy="${y}" r="18" fill="#fff" stroke="${band}" stroke-width="7" />`))
  return { svg, html: '' }
}

function renderDiagram(el, place) {
  const { svg, html } =
    place?.type === 'SUBWAY_STATION' && place.lines?.length
      ? drawSubway(place)
      : place?.type === 'BUS_STOP' && place.buses?.length
        ? drawBus(place)
        : drawDefault()
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" fill="none" aria-hidden="true">${svg}</svg>${html}`
}

const place = window.PLACE ?? null
document.querySelectorAll('.v5-diagram').forEach((el) => renderDiagram(el, place))
// 지금 계신 곳: 정보가 없으면 확인 중이라는 기존 문구 (CurrentLocation.jsx 와 같은 문구)
document.querySelectorAll('.v5-place').forEach((el) => {
  el.innerHTML = place?.name ? `지금 계신 곳<strong>${place.name}</strong>` : '지금 계신 곳을 확인하고 있어요'
})
