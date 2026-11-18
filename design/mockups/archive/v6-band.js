// 역명판 띠 부품 (시안). 장소 정보(window.PLACE)를 받아 .v6-band 안을 그린다.
//   지하철역     { type: 'SUBWAY_STATION', name, lines: [{ lineId, label, stationNo, prev, next }] }
//   버스정류장   { type: 'BUS_STOP', name, buses: [{ kind, numbers }], nearSubway: { name, lines: [{ lineId, label }] }, example }
//   정보 없음    null → 색 없는 선과 "확인하고 있어요"
// 형식은 v4 와 같다 (design/mockups/README.md 의 v4 절).
// 규칙: 선은 화면 양 끝까지 끊기지 않는다(가늘게, 노선색 그대로). 글씨는 선 위에 직접 올리지 않고 흰 표지나 흰 원 안에 쓴다.
//       표지는 테두리 없는 평평한 사각형이다. 버튼처럼 보이면 안 된다.

const WIDTH = 1920
const ROW_TOP = 124 // 첫 선의 높이
const ROW_BOTTOM = 248 // 마지막 선의 높이
const MAX_ROWS = 4

const BUS_KINDS = {
  TRUNK: { name: '간선', token: '--bus-trunk' },
  BRANCH: { name: '지선', token: '--bus-branch' },
  EXPRESS: { name: '광역', token: '--bus-express' },
  CIRCULAR: { name: '순환', token: '--bus-circular' },
}

/** 선 n 개의 높이. 1개면 가운데, 여러 개면 위아래로 고르게 */
function rowsOf(n) {
  if (n === 1) return [(ROW_TOP + ROW_BOTTOM) / 2]
  return Array.from({ length: n }, (_, i) => ROW_TOP + ((ROW_BOTTOM - ROW_TOP) * i) / (n - 1))
}

const line = (y, color) => `<path d="M0 ${y}H${WIDTH}" stroke="${color}" stroke-width="var(--line-width)" />`
const circle = (label, color, extra = '') => `<span class="v6-circle ${extra}" style="--c:${color}">${label}</span>`

function drawSubway(place) {
  const lines = place.lines.slice(0, MAX_ROWS)
  const ys = rowsOf(lines.length)
  const color = (l) => `var(--line-${l.lineId})`
  return {
    svg: lines.map((l, i) => line(ys[i], color(l))).join(''),
    // 선마다: 왼쪽 끝에 노선 번호 원, 그 옆에 앞 역, 오른쪽 끝에 다음 역
    marks: lines
      .map(
        (l, i) =>
          `<span class="v6-circle is-badge" style="--c:${color(l)};top:${ys[i]}px">${l.label}</span>` +
          (l.prev ? `<span class="v6-tag is-left" style="top:${ys[i]}px">${l.prev}</span>` : '') +
          (l.next ? `<span class="v6-tag is-right" style="top:${ys[i]}px">${l.next}</span>` : ''),
      )
      .join(''),
    // 이름판: 역 이름 + 노선마다 역 번호 원
    plate: `<div class="v6-name">${place.name.replace(/역$/, '')}</div>
      <div class="v6-sub">${lines.map((l) => (l.stationNo ? circle(l.stationNo, color(l)) : '')).join('')}</div>`,
  }
}

function drawBus(place) {
  const groups = place.buses.filter((g) => BUS_KINDS[g.kind]).slice(0, MAX_ROWS)
  const ys = rowsOf(groups.length)
  const near = place.nearSubway
  return {
    svg: groups.map((g, i) => line(ys[i], `var(${BUS_KINDS[g.kind].token})`)).join(''),
    // 선마다: 왼쪽 끝에 버스 종류, 오른쪽에 번호 표지 (종류마다 4개까지, 나머지는 "외 N대")
    marks: groups
      .map((g, i) => {
        const shown = g.numbers.slice(0, 4)
        const more = g.numbers.length - shown.length
        return (
          `<span class="v6-tag is-edge" style="top:${ys[i]}px">${BUS_KINDS[g.kind].name}</span>` +
          `<span class="v6-nums" style="top:${ys[i]}px">${shown.map((n) => `<span class="v6-tag is-num">${n}</span>`).join('')}${more > 0 ? `<span class="v6-tag">외 ${more}대</span>` : ''}</span>`
        )
      })
      .join(''),
    // 이름판: 정류장 이름 + 가까운 지하철(작게)
    plate: `<div class="v6-name">${place.name}</div>
      ${near ? `<div class="v6-sub"><span>가까운 지하철</span>${near.lines.slice(0, 4).map((l) => circle(l.label, `var(--line-${l.lineId})`)).join('')}<span>${near.name}</span></div>` : ''}`,
    note: place.example ? '버스 번호는 예시' : '',
  }
}

function drawDefault() {
  return {
    svg: rowsOf(3).map((y) => line(y, 'var(--line-none)')).join(''),
    marks: '',
    // 기존 문구 (CurrentLocation.jsx 의 불러오는 중 문구)
    plate: `<div class="v6-name is-waiting">지금 계신 곳을 확인하고 있어요</div>`,
  }
}

function renderBand(el, place) {
  const { svg, marks, plate, note = '' } =
    place?.type === 'SUBWAY_STATION' && place.lines?.length
      ? drawSubway(place)
      : place?.type === 'BUS_STOP' && place.buses?.length
        ? drawBus(place)
        : drawDefault()
  el.querySelector('.v6-lines').innerHTML = `<svg viewBox="0 0 ${WIDTH} 280" fill="none" aria-hidden="true">${svg}</svg>${marks}`
  el.querySelector('.v6-plate').innerHTML = plate
  el.querySelector('.v6-note').textContent = note
}

document.querySelectorAll('.v6-band').forEach((el) => renderBand(el, window.PLACE ?? null))
