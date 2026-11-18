// (build-v8.mjs 가 v8-band.js 에서 다시 만든 파일. 그 전에는 build-v7.mjs 가 v8-band.js 에서 만든 파일. 직접 고치지 않는다)
// 역명판 띠 부품 (시안). 장소 정보(window.PLACE)를 받아 .v8-band 안을 그린다.
// v6 과 구조는 같고 색만 옅다: 선은 원래 색의 30%(주 버튼과 비슷한 파랑은 20%), 고리는 60%(45%).
//   지하철역     { type: 'SUBWAY_STATION', name, lines: [{ lineId, label, stationNo, prev, next }] }
//   버스정류장   { type: 'BUS_STOP', name, buses: [{ kind, numbers }], nearSubway: { name, lines: [{ lineId, label }] }, example }
//   정보 없음    null → 색 없는 선과 "확인하고 있어요"
// 형식은 v4 와 같다 (design/mockups/README.md 의 v4 절).
// 규칙: 선은 화면 양 끝까지 끊기지 않는다(가늘게, 노선색 그대로). 글씨는 선 위에 직접 올리지 않고 흰 표지나 흰 원 안에 쓴다.
//       표지는 테두리 없는 평평한 사각형이다. 버튼처럼 보이면 안 된다.

const WIDTH = 1920
let ROW_TOP = 124 // 첫 선의 높이. renderBand 가 이름 상자 위쪽 끝 + 28px 로 다시 정한다
let ROW_BOTTOM = 248 // 마지막 선의 높이. renderBand 가 이름 상자 아래쪽 끝 − 20px 로 다시 정한다
let BAND_HEIGHT = 280 // 띠 높이. renderBand 가 실제 높이로 다시 정한다
const MAX_ROWS = 4

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
const tint = (hex, amount) => '#' + rgb(hex).map((c) => Math.round(255 + (c - 255) * amount).toString(16).padStart(2, '0')).join('')
/** 주 버튼 파랑과 비슷한 색인지 (1호선, 간선버스). 비슷하면 더 옅게 쓴다 */
function nearPrimary(hex) {
  const [a, b] = [rgb(hex), rgb(token('--color-primary'))]
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 70
}
/** 토큰 이름 → 선 색과 고리 색 (v5 와 같은 비율) */
function shades(tokenName) {
  const hex = token(tokenName)
  const soft = nearPrimary(hex)
  return { band: tint(hex, soft ? 0.2 : 0.3), ring: tint(hex, soft ? 0.45 : 0.6) }
}

/** 선 n 개의 높이. 1개면 가운데, 여러 개면 위아래로 고르게 */
function rowsOf(n) {
  if (n === 1) return [(ROW_TOP + ROW_BOTTOM) / 2]
  return Array.from({ length: n }, (_, i) => ROW_TOP + ((ROW_BOTTOM - ROW_TOP) * i) / (n - 1))
}

const line = (y, color) => `<path d="M0 ${y}H${WIDTH}" stroke="${color}" stroke-width="var(--line-width)" />`
const circle = (label, color, extra = '') => `<span class="v8-circle ${extra}" style="--c:${color}">${label}</span>`

function drawSubway(place) {
  const lines = place.lines.slice(0, MAX_ROWS)
  const ys = rowsOf(lines.length)
  const shade = (l) => shades(`--line-${l.lineId}`)
  return {
    svg: lines.map((l, i) => line(ys[i], shade(l).band)).join(''),
    // 선마다: 왼쪽 끝에 노선 번호 원, 그 옆에 앞 역, 오른쪽 끝에 다음 역
    marks: lines
      .map(
        (l, i) =>
          `<span class="v8-circle is-badge" style="--c:${shade(l).ring};top:${ys[i]}px">${l.label}</span>` +
          (l.prev ? `<span class="v8-tag is-left" style="top:${ys[i]}px">${l.prev}</span>` : '') +
          (l.next ? `<span class="v8-tag is-right" style="top:${ys[i]}px">${l.next}</span>` : ''),
      )
      .join(''),
    // 이름판: 역 이름 + 노선마다 역 번호 원
    plate: `<div class="v8-name">${place.name.replace(/역$/, '')}</div>
      <div class="v8-sub">${lines.map((l) => (l.stationNo ? circle(l.stationNo, shade(l).ring) : '')).join('')}</div>`,
  }
}

function drawBus(place) {
  const groups = place.buses.filter((g) => BUS_KINDS[g.kind]).slice(0, MAX_ROWS)
  const ys = rowsOf(groups.length)
  const near = place.nearSubway
  return {
    svg: groups.map((g, i) => line(ys[i], shades(BUS_KINDS[g.kind].token).band)).join(''),
    // 선마다: 왼쪽 끝에 버스 종류, 오른쪽에 번호 표지 (종류마다 4개까지, 나머지는 "외 N대")
    marks: groups
      .map((g, i) => {
        const shown = g.numbers.slice(0, 4)
        const more = g.numbers.length - shown.length
        return (
          `<span class="v8-tag is-edge" data-zone="kind${i}" style="top:${ys[i]}px">${BUS_KINDS[g.kind].name}</span>` +
          `<span class="v8-nums" data-zone="nums${i}" style="top:${ys[i]}px">${shown.map((n) => `<span class="v8-tag is-num">${n}</span>`).join('')}${more > 0 ? `<span class="v8-tag">외 ${more}대</span>` : ''}</span>`
        )
      })
      .join(''),
    // 이름판: 정류장 이름 + 가까운 지하철(작게)
    plate: `<div class="v8-name">${place.name}</div>
      ${near ? `<div class="v8-sub is-near"><span>가까운 지하철</span>${near.lines.slice(0, 4).map((l) => circle(l.label, shades(`--line-${l.lineId}`).ring)).join('')}<span>${near.name}</span></div>` : ''}`,
    note: place.example ? '버스 번호는 예시' : '',
  }
}

function drawDefault() {
  return {
    svg: rowsOf(3).map((y) => line(y, 'var(--line-none)')).join(''),
    marks: '',
    // 기존 문구 (CurrentLocation.jsx 의 불러오는 중 문구)
    plate: `<div class="v8-name is-waiting">지금 계신 곳을 확인하고 있어요</div>`,
  }
}

function renderBand(el, place) {
  const box = el.querySelector('.v8-plate')
  ROW_TOP = box.offsetTop + 28
  ROW_BOTTOM = box.offsetTop + box.offsetHeight - 20
  BAND_HEIGHT = el.offsetHeight
  const { svg, marks, plate, note = '' } =
    place?.type === 'SUBWAY_STATION' && place.lines?.length
      ? drawSubway(place)
      : place?.type === 'BUS_STOP' && place.buses?.length
        ? drawBus(place)
        : drawDefault()
  el.querySelector('.v8-lines').innerHTML = `<svg viewBox="0 0 ${WIDTH} ${BAND_HEIGHT}" fill="none" aria-hidden="true">${svg}</svg>${marks}`
  el.querySelector('.v8-plate').innerHTML = place?.name && (place.lines?.length || place.buses?.length) ? `<div class="v8-name">${displayPlaceName(place)}</div>` : plate
  document.fonts.ready.then(() => fitPlaceName(el)) // 글꼴을 읽은 뒤에 너비를 잰다 (v8-name.js)
  el.querySelector('.v8-note').textContent = note
}

document.querySelectorAll('.v8-band').forEach((el) => renderBand(el, window.PLACE ?? null))
