// 첫 화면 큰 띠(역명판)의 규칙 (디자인 문서 7절, 8-3·8-4절). 시안 design/mockups/confirmed/idle-band.js 를 화면 밖 순수 함수로 옮겼다.
// 측정(글자 너비)은 하지 않는다. 그리는 쪽(components/PlaceBand.jsx)이 잰 너비를 넘기면 여기서 정한다.
//
//   bandRows(place)        장소 정보 → 최대 3줄 (규칙 A·B·C·E·F·G). 정류장에 앞·다음 정류장이 오면 버스 줄도 지하철 줄처럼
//                          종류마다 왼쪽에 앞 정류장, 오른쪽에 다음 정류장을 그린다 (간선 → 지선 → 광역 순서, 갈리는 버스는 뒤쪽 줄.
//                          한 종류 안에서는 다음 정류장이 중앙차로인 버스가 먼저)
//   lineShades(hex, t)     노선색 → 선·고리·테두리 색 (규칙 D·I, 8-4절 진하기)
//   rowYs(count, mid)      줄의 세로 자리 (규칙 A)
//   nameLimits(...)        이름 상자가 넓어질 수 있는 반너비 세 가지 (7절 규칙 3·4)
//   decideHiding(...)      이름이 다 줄여도 넘칠 때 무엇을 숨기나 (7절 규칙 4)
//   chooseNumbers(...)     버스 줄 오른쪽: 번호 전부 / 개수 / 숨김 (규칙 G)
//   lineSegments(...)      선을 어디서 어디까지 그리나, "종점" 표지 자리 (규칙 E)
//
// 시안 파일의 규칙 문자(A~J)와 디자인 문서 8-4절 표의 문자는 조금 다르다. 아래 주석은 디자인 문서 8-4절 문자를 쓴다.

import { placeKind } from './placeName.js'

/** 띠 크기 (시안 idle-band.js 와 같은 값. 무대 1920 기준) */
export const BAND = Object.freeze({
  WIDTH: 1920,
  PAD: 48, // 좌우 여백
  MARGIN: 40, // 이름 상자와 좌우 요소 사이 여유 (7절 규칙 3)
  RESERVE: 300, // 버스 줄 오른쪽에 남겨 둘 최소 너비 ("간선 버스 12개" 표지, 7절 규칙 4)
  END_GAP: 96, // 종점에서 선이 이름 상자 밖으로 나가는 길이
  END_TAG_GAP: 16, // 선 끝과 "종점" 표지 사이
  END_TAG_ROOM: 90, // 오른쪽 끝에서 "종점" 표지가 들어갈 자리
  END_CAP_LEFT: 26, // 왼쪽 종점에서 선이 시작하는 자리 (여백 + 26)
  MAX_ROWS: 3,
  MAX_REST_MARKS: 3, // 셋째 줄에 모아 보이는 노선 표시 수 (규칙 B)
  ROW_GAP: 91, // 줄 간격 (규칙 A). CSS --row-gap 과 같다
})

/** 버스 종류 (8-5절 kind). 색 토큰이 없는 종류는 회색 선 (규칙 D) */
export const BUS_KINDS = Object.freeze({
  TRUNK: { name: '간선', token: '--bus-trunk' },
  BRANCH: { name: '지선', token: '--bus-branch' },
  EXPRESS: { name: '광역', token: '--bus-express' },
  CIRCULAR: { name: '순환', token: '--bus-circular' },
  VILLAGE: { name: '마을' },
  NIGHT: { name: '심야' },
  AIRPORT: { name: '공항' },
})
const BUS_ORDER = ['TRUNK', 'BRANCH', 'EXPRESS', 'CIRCULAR'] // 이 순서 다음은 모두 "그 밖" (규칙 F)
const OTHER = '그 밖'
const END = '종점'

export const kindName = (kind) => BUS_KINDS[kind]?.name ?? OTHER

/** prev·next 는 문자열 하나다. 배열이 오면 첫 번째만 쓴다 (갈림길은 아직 그리지 않는다, 8-4절) */
const one = (value) => (Array.isArray(value) ? value[0] : value) || null

const isNumbered = (line) => /^\d+$/.test(String(line.label))

/** 노선 표시: 글자 2자까지는 원, 그보다 길면 평평한 표지 + 색 막대 (규칙 C) */
function lineMark(line) {
  return { type: String(line.label).length <= 2 ? 'circle' : 'linetag', text: String(line.label), token: `--line-${line.lineId}` }
}

/*
 * 줄 하나의 모양
 *   token     선 색 토큰 이름. null 이면 회색 선 (셋째 줄 모음, 토큰 없는 종류)
 *   left      왼쪽 묶음: [{ type: 'circle' | 'linetag' | 'tag', text, token?, more? }]  (token 은 원·막대의 고리 색)
 *   right     오른쪽 표지 글자 (다음 역, "종점") 또는 null
 *   choices   버스 줄 오른쪽 후보 (앞에서부터 들어가는 것을 쓴다): [{ numbers: [...] } | { text }] 또는 null
 *             right 가 함께 있으면(앞·다음 정류장이 있는 버스 줄) 번호는 다음 정류장 표지 바로 왼쪽에 놓는다
 *   endLeft / endRight  그쪽이 종점인가
 *   more (왼쪽 표지), rightMore  그 줄의 버스 가운데 다른 곳에서 오거나 다른 곳으로 가는 것도 있다 → 이름 뒤에 "등"
 */
function subwayRows(place) {
  const numbered = place.lines.filter(isNumbered).sort((a, b) => Number(a.label) - Number(b.label))
  const named = place.lines.filter((l) => !isNumbered(l))
  const ordered = [...numbered, ...named]
  const main = ordered.length > BAND.MAX_ROWS ? ordered.slice(0, BAND.MAX_ROWS - 1) : ordered
  const rest = ordered.slice(main.length)
  const rows = main.map((line) => {
    const [prev, next] = [one(line.prev), one(line.next)]
    return {
      token: `--line-${line.lineId}`,
      left: [lineMark(line), { type: 'tag', text: prev ?? END }],
      right: next ?? END,
      choices: null,
      endLeft: !prev,
      endRight: !next,
    }
  })
  if (rest.length) {
    const shown = rest.slice(0, BAND.MAX_REST_MARKS)
    const left = shown.map(lineMark)
    if (rest.length > shown.length) left.push({ type: 'tag', text: `외 ${rest.length - shown.length}개 노선` })
    rows.push({ token: null, left, right: null, choices: null, endLeft: false, endRight: false })
  }
  return rows
}

const kindRank = (kind) => (BUS_ORDER.includes(kind) ? BUS_ORDER.indexOf(kind) : BUS_ORDER.length)
const byKind = (a, b) => kindRank(a.kind) - kindRank(b.kind) // 같은 순위는 받은 순서 그대로
/** 묶음의 우선 순서: 다음 정류장이 중앙차로 정류장인 묶음이 먼저, 그다음 버스가 많은 묶음 (같으면 받은 순서 그대로) */
const byPriority = (a, b) => Number(b.median) - Number(a.median) || b.numbers.length - a.numbers.length

/*
 * 앞·다음 정류장이 있는 버스정류장의 줄 (2026-11-21. 시안 없음). 지하철 줄과 같은 모양이다:
 * 왼쪽에 종류 표지와 앞 정류장, 오른쪽에 다음 정류장, 선은 그 종류의 색. 없는 쪽은 "종점".
 *
 * 묶음 = 종류와 앞·다음 정류장이 같은 버스들 ({ kind, numbers, prev, next, nextMedian }). 같은 정류장이어도 버스마다 앞·다음이 다른 곳이 많다.
 * 묶음에 prev·next 가 없으면 정류장의 prev·next 를 쓴다 (묶음별 값을 주지 않는 장소 정보).
 * nextMedian 은 다음 정류장이 중앙차로 정류장인가 (없으면 아닌 것으로 본다)
 */
function wayGroups(place) {
  return place.buses.map((g) => ({
    kind: g.kind,
    numbers: g.numbers,
    prev: one('prev' in g ? g.prev : place.prev),
    next: one('next' in g ? g.next : place.next),
    median: Boolean(g.nextMedian),
  }))
}

/**
 * 그쪽(prev 또는 next)에 보일 이름: 우선 순서가 가장 앞선 묶음의 것 (ranked 는 byPriority 순서).
 * 그 묶음이 종점이면 이름이 있는 다음 묶음의 것. 묶음마다 다르면 more (이름 뒤에 "등"). 모두 종점이면 name 이 null
 */
function wayName(ranked, key) {
  const named = ranked.find((g) => g[key])
  return { name: named ? named[key] : null, more: new Set(ranked.map((g) => g[key])).size > 1 }
}

/**
 * 묶음들 → 줄에 올릴 묶음 뭉치 (한 줄에 하나, 최대 3줄).
 *   1. 종류마다 우선 순서(중앙차로로 가는 묶음 → 버스가 많은 묶음)가 가장 앞선 묶음이 그 종류의 줄이다.
 *      줄 순서는 간선 → 지선 → 광역 → 순환 → 그 밖
 *   2. 그 줄과 앞·다음 정류장이 다른 묶음(갈리는 버스)은 종류 줄 뒤에 따로 한 줄씩. 우선 순서대로 자리를 준다
 *   3. 줄이 모자라면 갈리는 묶음을 같은 종류의 줄에 합친다 (그 줄의 정류장 이름 뒤에 "등")
 *   4. 종류만으로 3줄을 넘으면 앞의 두 종류만 한 줄씩, 나머지는 셋째 줄 "그 밖"에 모은다 (규칙 F 와 같다)
 */
function wayBundles(groups) {
  const kinds = [...new Set(groups.map((g) => g.kind))].sort((a, b) => kindRank(a) - kindRank(b))
  const perKind = kinds.map((kind) => groups.filter((g) => g.kind === kind).sort(byPriority))
  if (perKind.length > BAND.MAX_ROWS) return [...perKind.slice(0, BAND.MAX_ROWS - 1), perKind.slice(BAND.MAX_ROWS - 1).flat()]
  const mains = perKind.map((list) => [list[0]])
  const split = perKind.flatMap((list) => list.slice(1)).sort(byPriority)
  const room = BAND.MAX_ROWS - mains.length
  for (const g of split.slice(room)) mains[kinds.indexOf(g.kind)].push(g)
  return [...mains, ...split.slice(0, room).sort(byKind).map((g) => [g])]
}

/** 번호를 읽는 순서로: 숫자로 시작하는 것을 작은 수부터, 그다음 글자로 시작하는 것 ('101' < '9401' < '9401-1' < 'N13') */
function byNumber(a, b) {
  const [x, y] = [parseInt(a, 10), parseInt(b, 10)]
  if (Number.isNaN(x) !== Number.isNaN(y)) return Number.isNaN(x) ? 1 : -1
  return (Number.isNaN(x) ? 0 : x - y) || a.localeCompare(b, 'ko')
}

/** 한 줄에 올린 묶음들의 번호: 종류 순서대로. 한 종류의 묶음 여럿을 합쳤으면 그 종류 안에서 다시 번호 순으로 (같은 번호는 한 번만) */
function wayNumbers(bundle, kinds) {
  return kinds.flatMap((kind) => {
    const groups = bundle.filter((g) => g.kind === kind)
    const numbers = [...new Set(groups.flatMap((g) => g.numbers))]
    return groups.length > 1 ? numbers.sort(byNumber) : numbers
  })
}

function wayRow(bundle) {
  const kinds = [...new Set(bundle.map((g) => g.kind))]
  const oneKind = kinds.length === 1
  const ranked = [...bundle].sort(byPriority)
  const [prev, next] = [wayName(ranked, 'prev'), wayName(ranked, 'next')]
  return {
    token: oneKind ? (BUS_KINDS[kinds[0]]?.token ?? null) : null,
    left: [
      { type: 'tag', text: oneKind ? kindName(kinds[0]) : OTHER },
      { type: 'tag', text: prev.name ?? END, more: prev.more },
    ],
    right: next.name ?? END,
    rightMore: next.more,
    // 번호는 다음 정류장 표지 왼쪽에 전부 들어갈 때만 보인다 (규칙 G: 일부만 보이지 않는다). 종점 줄에는 두지 않는다
    choices: next.name ? [{ numbers: wayNumbers(bundle, kinds) }] : null,
    endLeft: !prev.name,
    endRight: !next.name,
  }
}

function busRows(place) {
  const ways = wayGroups(place)
  if (ways.some((g) => g.prev || g.next)) return wayBundles(ways).map(wayRow)
  // 앞·다음 정류장이 없으면 시안 그대로: 종류마다 한 줄 (왼쪽 종류, 오른쪽 번호)
  const groups = [...place.buses].sort(byKind)
  const room = BAND.MAX_ROWS
  const main = groups.length > room ? groups.slice(0, room - 1) : groups
  const rest = groups.slice(main.length)
  const rows = main.map((group) => ({
    token: BUS_KINDS[group.kind]?.token ?? null,
    left: [{ type: 'tag', text: kindName(group.kind) }],
    right: null,
    // 규칙 G: 전부 들어가면 번호, 아니면 개수
    choices: [{ numbers: [...group.numbers] }, { text: `${kindName(group.kind)} 버스 ${group.numbers.length}개` }],
    endLeft: false,
    endRight: false,
  }))
  if (rest.length) {
    const numbers = rest.flatMap((g) => g.numbers)
    const kinds = [...new Set(rest.map((g) => kindName(g.kind)))].join('·')
    rows.push({
      token: null,
      left: [{ type: 'tag', text: OTHER }],
      right: null,
      choices: [{ numbers }, { text: `${kinds} 버스 ${numbers.length}개` }, { text: `버스 ${numbers.length}개` }],
      endLeft: false,
      endRight: false,
    })
  }
  return rows
}

/** 장소 정보(8-5절) → 줄 목록. 그릴 수 없으면(정보 없음) null */
export function bandRows(place) {
  const kind = placeKind(place)
  if (kind === 'SUBWAY') return subwayRows(place)
  if (kind === 'BUS') return busRows(place)
  return null
}

/** 정보 없음일 때의 회색 선 수 (8-3절) */
export const WAITING_ROWS = 3

/** 줄의 세로 자리: 이름 상자 가운데(mid)를 중심으로 같은 간격 (규칙 A) */
export function rowYs(count, mid, gap = BAND.ROW_GAP) {
  return Array.from({ length: count }, (_, i) => mid + (i - (count - 1) / 2) * gap)
}

// ---------- 색 (규칙 D·I) ----------

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const hexOf = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
/** 흰색을 섞는다. amount 는 원래 색이 남는 비율 */
export const tint = (hex, amount) => hexOf(rgb(hex).map((c) => 255 + (c - 255) * amount))
const darken = (hex, amount) => hexOf(rgb(hex).map((c) => c * amount))
function luminance(hex) {
  const [r, g, b] = rgb(hex)
    .map((v) => v / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v ?? '')

/** 주 버튼과 비슷한 파랑인가 (그런 색은 -soft 진하기를 쓴다, 8-4절) */
function nearPrimary(hex, primary) {
  const [a, b] = [rgb(hex), rgb(primary)]
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 70
}

/**
 * 노선색 → { band(선), ring(원·막대), edge(테두리 또는 null) }. hex 가 없거나 이상하면 회색 (규칙 D)
 * t: CSS 토큰에서 읽은 값 { primary, bgGroup, none, textSub, lineTint, lineTintSoft, ringTint, ringTintSoft }
 */
export function lineShades(hex, t) {
  if (!isHex(hex)) return neutralShades(t)
  const soft = nearPrimary(hex, t.primary)
  const band = tint(hex, soft ? t.lineTintSoft : t.lineTint)
  // 규칙 I: 선이 띠 바탕과 대비 1.3 미만이고, 원래 색도 띠 바탕과 대비 2 미만(노랑 계열)이면 같은 색을 어둡게 한 테두리
  const edge = !soft && contrast(band, t.bgGroup) < 1.3 && contrast(hex, t.bgGroup) < 2 ? darken(hex, 0.72) : null
  return { band, ring: tint(hex, soft ? t.ringTintSoft : t.ringTint), edge }
}

export const neutralShades = (t) => ({ band: t.none, ring: t.textSub, edge: null })

// ---------- 이름 상자 너비 (7절 규칙 3·4) ----------

/**
 * 이름 상자 반너비의 한계 세 단계 (화면 가운데에서 한쪽으로).
 *   groupsRight   보이는 왼쪽 묶음 중 가장 오른쪽 끝 (없으면 0)
 *   rightTagsLeft 보이는 오른쪽 표지(다음 역) 중 가장 왼쪽 끝 (없으면 WIDTH)
 *   hasNumbers    버스 번호 줄이 있는가 (있으면 개수 표지 자리 RESERVE 를 남긴다)
 * 돌려주는 값: { full: 모두 보일 때, noNumbers: 오른쪽 표지를 숨겼을 때, noMarks: 좌우 요소를 모두 숨겼을 때 }
 */
export function nameLimits({ groupsRight = 0, rightTagsLeft = BAND.WIDTH, hasNumbers = false }) {
  const center = BAND.WIDTH / 2
  const half = (left, right, reserve) => Math.min(center - left, Math.min(right, BAND.WIDTH - BAND.PAD - reserve) - center) - BAND.MARGIN
  return {
    full: half(groupsRight, rightTagsLeft, hasNumbers ? BAND.RESERVE : 0),
    noNumbers: half(groupsRight, rightTagsLeft, 0),
    noMarks: half(0, BAND.WIDTH, 0),
  }
}

/**
 * 이름 글자에 줄 수 있는 최대 너비 (useFitText 의 한계). 이름 상자 = max(최소 너비, 글자 + 좌우 안쪽 여백)
 * 상자가 최소 너비로도 반너비 한계를 넘으면 어떤 글자도 들어가지 않는다 → 음수
 */
export function nameMaxWidth(halfLimit, { plateMin, platePad }) {
  return 2 * halfLimit >= plateMin ? 2 * halfLimit - 2 * platePad : -1
}

/**
 * 글씨를 최소 크기까지 줄인 뒤의 이름 상자 너비(plateWidth)로 무엇을 숨기나 (7절 규칙 4, 시안 fitName).
 * 순서: 오른쪽 표지(버스 번호)를 숨긴다 → 그래도 넘치면 좌우 요소를 모두 숨긴다.
 * fits 는 다 숨긴 뒤에도 들어가는가 (false 면 이름 양 끝이 띠 밖으로 잘린다, 7절 표 마지막 줄)
 */
export function decideHiding({ plateWidth, limits, hasNumbers }) {
  const fitsIn = (half) => plateWidth / 2 <= half
  if (fitsIn(limits.full)) return { numbersHidden: false, marksHidden: false, fits: true }
  if (hasNumbers && fitsIn(limits.noNumbers)) return { numbersHidden: true, marksHidden: false, fits: true }
  return { numbersHidden: hasNumbers, marksHidden: true, fits: fitsIn(limits.noMarks) }
}

/**
 * 버스 줄 오른쪽: 후보 너비(choiceWidths, choices 순서) 중 남은 자리에 들어가는 첫 번째 (규칙 G).
 * 남은 자리 = 오른쪽 여백까지 - 이름 상자 오른쪽 끝 - 여유. 하나도 안 들어가면 -1 (숨김)
 * taken 은 오른쪽 여백 쪽에 이미 놓인 것의 너비다 (다음 정류장 표지 + 사이 간격). 번호는 그 왼쪽에 놓인다
 */
export function chooseNumbers({ choiceWidths, plateRight, taken = 0 }) {
  const available = BAND.WIDTH - BAND.PAD - taken - plateRight - BAND.MARGIN
  return choiceWidths.findIndex((w) => w <= available)
}

/** 시안의 결과 이름 (band.dataset.placeName 의 busText 와 같은 말) */
export const choiceLabel = (index) => (index === 0 ? '번호 전부' : index > 0 ? '개수' : '숨김')

// ---------- 선 (규칙 E) ----------

/**
 * 줄마다 선의 시작·끝과 "종점" 표지 자리. 선은 화면 양 끝까지, 종점인 쪽만 이름 상자 근처에서 끝난다.
 * 좌우 요소를 모두 숨겼으면(marksShown false) 종점 표시도 없이 양 끝까지 그린다 (시안 drawLines)
 * 돌려주는 값: [{ y, from, to, cap: 'round' | 'butt', endTagLeft: 숫자 또는 null }]
 */
export function lineSegments({ rows, ys, plateRight, marksShown }) {
  return rows.map((row, i) => {
    const from = row.endLeft && marksShown ? BAND.PAD + BAND.END_CAP_LEFT : 0
    const to = row.endRight && marksShown ? Math.min(BAND.WIDTH, plateRight + BAND.END_GAP) : BAND.WIDTH
    const endTagLeft =
      row.endRight && marksShown ? Math.min(BAND.WIDTH - BAND.PAD - BAND.END_TAG_ROOM, plateRight + BAND.END_GAP + BAND.END_TAG_GAP) : null
    return { y: ys[i], from, to, cap: to < BAND.WIDTH || from > 0 ? 'round' : 'butt', endTagLeft }
  })
}
