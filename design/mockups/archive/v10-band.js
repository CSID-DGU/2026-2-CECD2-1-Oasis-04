// 역명판 띠 부품 (확정판, 2026-11-17). 손으로 쓴 파일이다. 스타일은 v8.css + v10-extra.css.
// 모양은 v8 그대로(굵은 이름, 둥근 이름 상자, 옅은 선, 흰 표지에 담은 버스 번호, 화면 끝까지 이어지는 선)이고,
// 깨지는 경우를 막는 규칙만 v9 에서 가져왔다. 장소 정보(window.PLACE)를 받아 .v8-band 안을 그린다.
//
// 띠 규칙
//   A. 띠 높이는 고정이다. 줄은 최대 3줄, 줄 간격도 고정이다. 줄이 1~2개면 같은 간격으로 가운데에 모은다
//   B. 지하철 노선이 3개를 넘으면: 번호 있는 노선 2개(번호순)는 한 줄씩, 나머지는 셋째 줄에 노선 표시만 모은다(3개까지, 더 있으면 "외 N개 노선")
//   C. 번호 없는 노선(공항철도 등)은 원이 아니라 평평한 표지 + 왼쪽 색 막대로 그린다
//   D. 색 토큰이 없는 노선은 회색 선으로 그린다. 사라지지 않는다
//   E. 종점: 다음 역이 없는 쪽은 선을 이름 상자 근처에서 끝내고 "종점" 표지를 둔다. 그 밖의 선은 화면 양 끝까지 이어진다
//      (갈림길은 규칙만 정했고 아직 그리지 않는다: 디자인 문서 8절)
//   F. 앞뒤 역은 노선 수와 상관없이 한쪽에 하나씩 보인다. prev·next 는 문자열 하나다
//   G. 버스 종류가 3개를 넘으면: 간선·지선·광역·순환·그 밖의 순서로 앞의 2개는 한 줄씩, 나머지는 셋째 줄에 모은다. 모르는 종류도 버리지 않는다
//   H. 버스 번호는 일부만 보여 주지 않는다("외 N" 없음). 그 줄의 번호가 전부 들어가면 번호를 흰 표지에 하나씩,
//      다 안 들어가면 번호 대신 "간선 버스 10개"처럼 개수만 쓴다. 셋째 줄은 "광역·마을·심야 버스 9개"처럼 종류 이름과 개수
//   I. 이름은 항상 한 줄이고, 번호가 이름보다 먼저 양보한다(문서 7절): 버스 줄마다 개수 표지가 들어갈 자리(RESERVE)만 남기면 된다.
//      이름이 그 자리까지 차지하면 글씨를 72px 까지 줄이고, 그래도 안 되면 오른쪽 표지를 숨기고, 그래도 안 되면 좌우 요소를 모두 숨긴다
//   J. 옅어서 띠 바탕과 구별이 안 되는 색(순환버스 노랑 등, 대비 1.3 미만)은 선 위아래에 같은 색의 진한 테두리를 얇게 두른다

const WIDTH = 1920
const PAD = 48
const MARGIN = 40 // 이름 상자와 좌우 요소 사이 여유
const RESERVE = 300 // 버스 줄 오른쪽에 남겨 둘 최소 너비 ("간선 버스 12개" 표지)
const END_GAP = 96 // 종점에서 선이 이름 상자 밖으로 나가는 길이
const MAX_ROWS = 3

const BUS_KINDS = {
  TRUNK: { name: '간선', token: '--bus-trunk' },
  BRANCH: { name: '지선', token: '--bus-branch' },
  EXPRESS: { name: '광역', token: '--bus-express' },
  CIRCULAR: { name: '순환', token: '--bus-circular' },
  VILLAGE: { name: '마을' },
  NIGHT: { name: '심야' },
  AIRPORT: { name: '공항' },
}
const BUS_ORDER = ['TRUNK', 'BRANCH', 'EXPRESS', 'CIRCULAR']
const kindName = (kind) => BUS_KINDS[kind]?.name ?? '그 밖'

const rootStyle = getComputedStyle(document.documentElement)
const token = (name) => rootStyle.getPropertyValue(name).trim()
const num = (name, fallback) => parseFloat(token(name)) || fallback
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const hexOf = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
const tint = (hex, amount) => hexOf(rgb(hex).map((c) => 255 + (c - 255) * amount))
const darken = (hex, amount) => hexOf(rgb(hex).map((c) => c * amount))
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
function nearPrimary(hex) {
  const [a, b] = [rgb(hex), rgb(token('--color-primary'))]
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 70
}
/** 토큰 이름 → 선 색, 고리 색, (필요하면) 테두리 색. 토큰이 없으면 회색 (규칙 D) */
function shades(tokenName) {
  const hex = tokenName ? token(tokenName) : ''
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return neutral()
  const soft = nearPrimary(hex)
  const band = tint(hex, num(soft ? '--line-tint-soft' : '--line-tint', 0.3))
  // 규칙 J: 띠 바탕과 대비가 1.3 미만이면 같은 색을 어둡게 한 테두리를 두른다
  const edge = contrast(band, token('--color-bg-group')) < 1.3 && !soft ? edgeOf(hex, band) : null
  return { band, ring: tint(hex, num(soft ? '--ring-tint-soft' : '--ring-tint', 0.6)), edge }
}
/** 테두리는 대비가 아주 낮은 색(노랑 계열)에만 두른다: 원래 색 자체가 띠 바탕과 대비 2 미만일 때 */
const edgeOf = (hex) => (contrast(hex, token('--color-bg-group')) < 2 ? darken(hex, 0.72) : null)
const neutral = () => ({ band: token('--line-none'), ring: token('--color-text-sub'), edge: null })

const one = (value) => (Array.isArray(value) ? value[0] : value) || null // prev·next 는 문자열 하나. 배열이 오면 첫 번째만 쓴다
const tag = (text, extra = '') => `<span class="v8-tag ${extra}">${text}</span>`
/** 노선 표시: 글자 2자까지는 원, 그보다 길면 평평한 표지 + 색 막대 (규칙 C) */
const lineMark = (line, ring) =>
  String(line.label).length <= 2 ? `<span class="v8-circle" style="--c:${ring}">${line.label}</span>` : `<span class="v8-tag v9-linetag" style="--c:${ring}">${line.label}</span>`

// ---------- 줄 만들기: 장소 정보 → 최대 3줄 ----------
// 줄 하나 = { color, left: 왼쪽 묶음 HTML, right: 오른쪽 표지 글자, choices: 오른쪽 표지 후보(버스), endLeft, endRight }

function subwayRows(place) {
  const numbered = place.lines.filter((l) => /^\d+$/.test(String(l.label))).sort((a, b) => Number(a.label) - Number(b.label))
  const named = place.lines.filter((l) => !/^\d+$/.test(String(l.label)))
  const ordered = [...numbered, ...named]
  const main = ordered.length > MAX_ROWS ? ordered.slice(0, MAX_ROWS - 1) : ordered
  const rest = ordered.slice(main.length)
  const rows = main.map((line) => {
    const color = shades(`--line-${line.lineId}`)
    const [prev, next] = [one(line.prev), one(line.next)]
    return { color, left: lineMark(line, color.ring) + tag(prev ?? '종점'), right: next ?? '종점', endLeft: !prev, endRight: !next }
  })
  if (rest.length) {
    const shown = rest.slice(0, 3)
    rows.push({
      color: neutral(),
      left: shown.map((line) => lineMark(line, shades(`--line-${line.lineId}`).ring)).join('') + (rest.length > shown.length ? tag(`외 ${rest.length - shown.length}개 노선`) : ''),
      right: null,
    })
  }
  return rows
}

function busRows(place) {
  const rank = (kind) => (BUS_ORDER.includes(kind) ? BUS_ORDER.indexOf(kind) : BUS_ORDER.length)
  const groups = [...place.buses].sort((a, b) => rank(a.kind) - rank(b.kind))
  const main = groups.length > MAX_ROWS ? groups.slice(0, MAX_ROWS - 1) : groups
  const rest = groups.slice(main.length)
  const numberTags = (numbers) => numbers.map((n) => tag(n, 'is-num')).join('')
  const rows = main.map((group) => ({
    color: shades(BUS_KINDS[group.kind]?.token),
    left: tag(kindName(group.kind)),
    right: null,
    // 규칙 H: 전부 들어가면 번호, 아니면 개수
    choices: [numberTags(group.numbers), tag(`${kindName(group.kind)} 버스 ${group.numbers.length}개`)],
  }))
  if (rest.length) {
    const numbers = rest.flatMap((g) => g.numbers)
    const kinds = [...new Set(rest.map((g) => kindName(g.kind)))].join('·')
    rows.push({ color: neutral(), left: tag('그 밖'), right: null, choices: [numberTags(numbers), tag(`${kinds} 버스 ${numbers.length}개`), tag(`버스 ${numbers.length}개`)] })
  }
  return rows
}

// ---------- 그리기 ----------
async function renderBand(band, place) {
  const box = band.querySelector('.v8-plate')
  const lines = band.querySelector('.v8-lines')
  const rows = place?.type === 'SUBWAY_STATION' && place.lines?.length ? subwayRows(place) : place?.type === 'BUS_STOP' && place.buses?.length ? busRows(place) : null

  const mid = box.offsetTop + box.offsetHeight / 2
  const gap = num('--row-gap', 91)
  const count = rows ? rows.length : 3
  const ys = Array.from({ length: count }, (_, i) => mid + (i - (count - 1) / 2) * gap)
  const svgOpen = `<svg viewBox="0 0 ${WIDTH} ${band.offsetHeight}" fill="none" aria-hidden="true">`

  if (!rows) {
    box.innerHTML = `<div class="v8-name is-waiting">지금 계신 곳을 확인하고 있어요</div>`
    lines.innerHTML = svgOpen + ys.map((y) => `<path d="M0 ${y}H${WIDTH}" stroke="${token('--line-none')}" stroke-width="var(--line-width)" />`).join('') + '</svg>'
    return
  }

  box.innerHTML = `<div class="v8-name">${displayPlaceName(place)}</div>`
  band.querySelector('.v8-note').textContent = place.example ? '버스 번호는 예시' : ''
  lines.innerHTML =
    svgOpen +
    '</svg>' +
    rows
      .map((row, i) => {
        const at = `data-row="${i}" style="top:${ys[i]}px"`
        return (
          `<span class="v9-group" ${at}>${row.left}</span>` +
          (row.right ? `<span class="v8-tag is-right" ${at}>${row.right}</span>` : '') +
          (row.choices ? `<span class="v8-nums" data-zone="nums${i}" ${at}></span>` : '')
        )
      })
      .join('')

  await document.fonts.ready
  const info = fitName(band, rows)
  fillNumbers(band, rows, info)
  drawLines(band, rows, ys)
  band.dataset.placeName = JSON.stringify(info)
}

/** 이름 크기 정하기 (문서 7절 + 규칙 I). 돌려주는 값: { size, numbersHidden, marksHidden, fits, busText } */
function fitName(band, rows) {
  const box = band.querySelector('.v8-plate')
  const name = box.querySelector('.v8-name')
  const left0 = band.getBoundingClientRect().left
  const center = WIDTH / 2
  const visible = (el) => el.style.display !== 'none'
  let reserve = rows.some((r) => r.choices) ? RESERVE : 0
  const halfLimit = () => {
    const left = Math.max(0, ...[...band.querySelectorAll('.v9-group')].filter(visible).map((m) => m.getBoundingClientRect().right - left0))
    const fixedRight = Math.min(WIDTH, ...[...band.querySelectorAll('.v8-tag.is-right')].filter(visible).map((m) => m.getBoundingClientRect().left - left0))
    return Math.min(center - left, Math.min(fixedRight, WIDTH - PAD - reserve) - center) - MARGIN
  }
  const fits = () => box.getBoundingClientRect().width / 2 <= halfLimit()

  const base = parseFloat(getComputedStyle(name).fontSize)
  const min = Math.min(base, num('--place-name-min', 72))
  const step = num('--place-name-step', 8)
  let size = base
  name.style.fontSize = `${size}px`
  while (!fits() && size > min) {
    size = Math.max(min, size - step)
    name.style.fontSize = `${size}px`
  }
  const info = { size, numbersHidden: false, marksHidden: false, fits: true, busText: [] }
  if (!fits() && reserve) {
    reserve = 0
    band.querySelectorAll('.v8-nums').forEach((el) => (el.style.display = 'none'))
    info.numbersHidden = true
  }
  if (!fits()) {
    band.querySelectorAll('.v9-group, .v8-tag.is-right, .v8-nums').forEach((el) => (el.style.display = 'none'))
    info.marksHidden = true
  }
  info.fits = fits() || info.marksHidden
  return info
}

/** 버스 줄의 오른쪽 표지: 번호가 전부 들어가면 번호, 아니면 개수 (규칙 H) */
function fillNumbers(band, rows, info) {
  const left0 = band.getBoundingClientRect().left
  const available = WIDTH - PAD - (band.querySelector('.v8-plate').getBoundingClientRect().right - left0) - MARGIN
  band.querySelectorAll('.v8-nums').forEach((el) => {
    if (el.style.display === 'none') return
    const choices = rows[Number(el.dataset.row)].choices
    const chosen = choices.findIndex((html) => {
      el.innerHTML = html
      return el.getBoundingClientRect().width <= available
    })
    if (chosen < 0) el.style.display = 'none'
    info.busText.push(chosen === 0 ? '번호 전부' : chosen > 0 ? '개수' : '숨김')
  })
}

/** 선: 화면 양 끝까지. 종점인 쪽만 이름 상자 근처에서 끝난다 (규칙 E) */
function drawLines(band, rows, ys) {
  const left0 = band.getBoundingClientRect().left
  const plate = band.querySelector('.v8-plate').getBoundingClientRect()
  const marksShown = band.querySelector('.v9-group')?.style.display !== 'none'
  const w = num('--line-width', 14)
  band.querySelector('.v8-lines svg').innerHTML = rows
    .map((row, i) => {
      const from = row.endLeft && marksShown ? PAD + 26 : 0
      const to = row.endRight && marksShown ? Math.min(WIDTH, plate.right - left0 + END_GAP) : WIDTH
      const cap = to < WIDTH || from > 0 ? 'round' : 'butt'
      const path = (color, width) => `<path d="M${from} ${ys[i]}H${to}" stroke="${color}" stroke-width="${width}" stroke-linecap="${cap}" />`
      // 규칙 J: 옅은 색은 진한 테두리(위아래 3px)를 먼저 그리고 그 위에 선을 그린다
      return (row.color.edge ? path(row.color.edge, w) : '') + path(row.color.band, row.color.edge ? w - 6 : w)
    })
    .join('')
  // 오른쪽 종점의 "종점" 표지는 선이 끝나는 자리 바로 뒤에 둔다
  rows.forEach((row, i) => {
    if (!row.endRight) return
    const end = band.querySelector(`.v8-tag.is-right[data-row="${i}"]`)
    if (!end) return
    end.classList.remove('is-right')
    end.classList.add('v9-end')
    end.style.left = `${Math.min(WIDTH - PAD - 90, plate.right - left0 + END_GAP + 16)}px`
  })
}

document.querySelectorAll('.v8-band').forEach((band) => renderBand(band, window.PLACE ?? null))
