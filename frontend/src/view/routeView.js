// 경로 응답(api.route 의 routes[]) → 경로 안내 화면(ROUTE_GUIDE)이 그대로 그릴 모양 (계획서 8단계, 디자인 문서 9절).
// 원본: 확정 시안 design/mockups/confirmed/route-guide-final.html 의 <script> (rides, transfersOf, R1, mark, colorOf,
// legLines, timelineOf). 화면이 판단하지 않도록 판단은 모두 여기서 한다. React 없이 테스트한다 (view/__tests__/routeView.test.js).
//
// 들어오는 경로 (디자인 문서 9-2절 형식. mock 과 real 이 같은 모양으로 준다)
//   { id, durationMin, exit?, start?: { name, kind }, legs: [
//       { mode: 'SUBWAY', lineId?, label, stops?, via?, to: { name, kind } }
//       { mode: 'BUS',    kind?, number, stops?, via?, to }
//       { mode: 'WALK',   minutes, to? }      to 가 없으면 같은 역 안에서 걷는다
//   ] }
//   장소 kind: 'STATION' | 'STOP' | 'PLACE'. 버스 kind: 'TRUNK' | 'BRANCH' | 'EXPRESS' | 'CIRCULAR' | 'VILLAGE' | 'NIGHT' | 'AIRPORT'
//                                              + 경기버스 'GG_GENERAL'(일반) | 'GG_SEAT'(좌석) | 'GG_DIRECT'(직행좌석)
//
// 여기서 하지 않는 것 (9단계 화면 부품이 한다): 글자 너비가 있어야 하는 판단. 카드 노선 줄 접기(R5),
// 타임라인 넘침에 따라 ①~④ 중 어느 단계를 쓸지(R2), 두 줄 이름 36px. 이 파일은 단계별 타임라인 항목 목록만 미리 만든다.

/** 색 토큰이 있는 지하철 노선 ID (global.css :root 의 --line-<id>, 디자인 문서 3-6절) */
export const LINE_IDS_WITH_COLOR = Object.freeze([
  'seoul-1', 'seoul-2', 'seoul-3', 'seoul-4', 'seoul-5', 'seoul-6', 'seoul-7', 'seoul-8', 'seoul-9',
  'arex', 'gyeongui-jungang', 'suin-bundang', 'gtx-a',
])

/**
 * 색 토큰이 있는 버스 종류. 그 밖의 종류(심야·공항·모르는 값)는 회색 (계획서 6-1절 #7)
 * 마을버스는 지선과 같은 초록으로 칠한다 (2026-11-22 방선우. 서울 마을버스가 초록이다. 토큰을 새로 만들지 않고 지선 토큰을 같이 쓴다)
 * 경기버스는 경기버스 색으로 칠한다 (2026-11-22 방선우): 일반형 초록, 좌석형 파랑, 직행좌석형 빨강.
 *   종류 값 GG_GENERAL · GG_SEAT · GG_DIRECT 는 경로에서만 온다 (api/real/routeLegs.js 가 카카오 안내 문구의 "일반"·"좌석"·"직행" 으로 정한다)
 */
export const BUS_KIND_COLORS = Object.freeze({
  TRUNK: '--bus-trunk',
  BRANCH: '--bus-branch',
  EXPRESS: '--bus-express',
  CIRCULAR: '--bus-circular',
  VILLAGE: '--bus-branch',
  GG_GENERAL: '--bus-gg-general',
  GG_SEAT: '--bus-gg-seat',
  GG_DIRECT: '--bus-gg-direct',
})

export const NO_COLOR = '--line-none'
export const MAX_TRANSFERS = 2 // R1
export const MAX_ROUTES = 3 // R1

const isRide = (leg) => leg.mode === 'SUBWAY' || leg.mode === 'BUS'

/** 노선 표시 모양: 'circle'(번호 있는 지하철) | 'tag'(번호 없는 노선, 2자 넘는 이름) | 'bus'(버스 번호 네모) (3-6절, R6) */
function markOf(leg) {
  if (leg.mode === 'BUS') return 'bus'
  return String(leg.label ?? '').length > 2 ? 'tag' : 'circle'
}

/** 장식 색 토큰 이름. 노선색 위에 글자를 올리지 않는다 (3-6절). 번호 없는 노선은 노선 ID 가 와도 시안처럼 회색 (R6) */
function colorOf(leg, mark) {
  if (mark === 'bus') return BUS_KIND_COLORS[leg.kind] ?? NO_COLOR
  if (mark === 'tag') return NO_COLOR
  return LINE_IDS_WITH_COLOR.includes(leg.lineId) ? `--line-${leg.lineId}` : NO_COLOR
}

/** "N번째 역에서 내려요" / "다음 정류장에서 내려요". 정거장 수를 모르면 null (줄을 쓰지 않는다) */
export function stopsSentence(mode, stops) {
  if (!Number.isInteger(stops) || stops < 1) return null
  const unit = mode === 'BUS' ? '정류장' : '역'
  return `${stops === 1 ? '다음' : `${stops}번째`} ${unit}에서 내려요`
}

const walkText = (minutes) => `걸어서 ${minutes}분`

function toLegView(leg) {
  if (!isRide(leg)) {
    return { mode: 'WALK', minutes: leg.minutes ?? null, to: leg.to ?? null, text: walkText(leg.minutes) }
  }
  const mark = markOf(leg)
  const stops = Number.isInteger(leg.stops) ? leg.stops : Array.isArray(leg.via) ? leg.via.length : null
  return {
    mode: leg.mode,
    mark,
    text: mark === 'bus' ? String(leg.number ?? '') : String(leg.label ?? ''), // 표지 안 글자 (버스 번호는 자르지 않는다)
    lineId: leg.lineId ?? null,
    kind: leg.kind ?? null,
    color: colorOf(leg, mark),
    stops,
    stopsText: stopsSentence(leg.mode, stops),
    to: leg.to ?? null,
  }
}

/** 타는 구간 수 - 1. 서버의 transfers 대신 이 값으로 R1 을 판단한다 (시안 transfersOf 와 같다) */
export const transfersOf = (route) => Math.max(0, (route.legs ?? []).filter(isRide).length - 1)

/**
 * 타임라인 항목 목록 (시안 timelineOf). level 1 = 기본, 2 = 걸어서 갈아타는 곳을 한 줄로(R2-②), 4 = 가운데 접기(R2-④)
 * 항목: { type: 'stop', place, role, tone: 'from' | 'mid' | 'dest' | '', exit }  role 이 '' 면 라벨 없음
 *       { type: 'walk', text, toStop }   toStop: 다음이 점이면 true (선 끝 모양)
 *       { type: 'ride', leg }
 *       { type: 'fold', more }           "갈아타기 N번 더 / 자세한 길은 휴대폰으로 보내 드려요"
 */
export function timelineOf(route, level = 1) {
  const items = []
  const legs = route.legs
  const stop = (place, role, tone = '', exit = null) => items.push({ type: 'stop', place, role, tone, exit })
  const walkRow = (text, toStop) => items.push({ type: 'walk', text, toStop })
  const ride = (leg) => items.push({ type: 'ride', leg })
  const lastRide = legs.map(isRide).lastIndexOf(true)
  const firstRide = legs.findIndex(isRide)
  // R7·R8: 마지막 차에서 내린 곳에 "내리는 곳"과 출구(없으면 null). 목적지가 장소면 걸어서 N분 → "가실 곳"
  const tail = (i) => {
    stop(legs[i].to, '내리는 곳', '', route.exit)
    legs.slice(i + 1).forEach((w) => {
      walkRow(w.text, !!w.to)
      if (w.to) stop(w.to, '가실 곳', 'dest')
    })
  }
  stop(route.start, legs[0]?.mode === 'WALK' ? '지금 계신 곳' : '타는 곳', 'from')

  // R4: 걸어서만 가는 경로
  if (lastRide < 0) {
    legs.forEach((w) => {
      walkRow(w.text, !!w.to)
      if (w.to) stop(w.to, '가실 곳', 'dest')
    })
    return items
  }
  // R2-④: 첫 구간과 마지막 구간만 남기고 가운데를 접는다
  if (level >= 4 && route.rides.length > 2) {
    for (let i = 0; i < firstRide; i++) {
      walkRow(legs[i].text, !!legs[i].to)
      if (legs[i].to) stop(legs[i].to, '타는 곳')
    }
    ride(legs[firstRide])
    items.push({ type: 'fold', more: route.transfers - 1 })
    stop(legs[lastRide - 1].to ?? legs[lastRide - 2].to, '갈아타는 곳', 'mid')
    ride(legs[lastRide])
    tail(lastRide)
    return items
  }
  legs.forEach((leg, i) => {
    if (i > lastRide) return // 마지막 구간 뒤 걷기는 tail 이 그린다
    if (leg.mode === 'WALK') {
      const prev = legs[i - 1]
      // R2-②: 내려서 다른 곳까지 걸어가 갈아타면 내린 곳 줄을 없애고 걷는 줄에 이름을 넣는다
      const merged = level >= 2 && prev && prev.mode !== 'WALK' && leg.to
      walkRow(merged ? `${prev.to.name}에서 내려 ${leg.text}` : leg.text, !!leg.to)
      // 다른 곳까지 걸으면 그곳이 다음 점이다. 처음 걷기 뒤면 "타는 곳", 갈아타는 중이면 "갈아타는 곳"(다음 차를 타는 곳)
      if (leg.to) stop(leg.to, i === 0 ? '타는 곳' : '갈아타는 곳', i === 0 ? '' : 'mid')
      return
    }
    ride(leg)
    if (i === lastRide) return tail(i)
    // 내려서 다른 곳까지 걸어가 갈아타면 내리는 곳에는 라벨을 두지 않는다. 같은 역 안에서 갈아타면 여기가 갈아타는 곳
    const walksAway = legs[i + 1]?.mode === 'WALK' && legs[i + 1].to
    if (level >= 2 && walksAway) return // R2-②
    stop(leg.to, walksAway ? '' : '갈아타는 곳', 'mid')
  })
  return items
}

/**
 * 경로 하나 → 화면용 모양.
 * here: 지금 계신 곳 { name, kind } — 경로에 start 가 없을 때(real) 쓴다. 그것도 없으면 이름 '지금 계신 곳'
 */
export function toRouteView(route, { here = null } = {}) {
  const legs = (route.legs ?? []).map(toLegView)
  const rides = legs.filter(isRide)
  const lastRide = legs.map(isRide).lastIndexOf(true)
  const after = legs.slice(lastRide + 1)
  const lastWalk = lastRide >= 0 && after.length ? after[after.length - 1] : null
  const dest = lastRide < 0 ? (legs[legs.length - 1]?.to ?? null) : (lastWalk?.to ?? legs[lastRide].to ?? null)
  const exit = route.exit ? String(route.exit) : null // R8: 없으면 null → 아무것도 쓰지 않는다
  const view = {
    id: route.id,
    durationMin: Number.isFinite(route.durationMin) ? route.durationMin : null,
    transfers: Math.max(0, rides.length - 1),
    exit,
    hasExit: exit !== null,
    start: route.start ?? here ?? { name: '지금 계신 곳', kind: 'PLACE' },
    legs,
    rides,
    walkOnly: rides.length === 0, // R4: 카드에 "걸어서"
    hasBus: rides.some((l) => l.mode === 'BUS'),
    lastWalk: lastWalk ? { minutes: lastWalk.minutes, to: lastWalk.to } : null, // 마지막 차 뒤 걷기 (R7)
    dest,
    endsAtPlace: dest?.kind === 'PLACE', // R7
  }
  view.timeline = {
    full: timelineOf(view, 1),
    merged: timelineOf(view, 2),
    folded: rides.length > 2 ? timelineOf(view, 4) : null,
  }
  return view
}

/**
 * 경로 목록 → 화면 전체 모양 (R1, R3)
 *   routes    보일 경로 (환승 2회 이하 최대 3개. 없으면 환승이 가장 적은 경로 하나)
 *   fallback  환승 2회 이하 경로가 없어 하나만 보이는 경우. 화면은 타임라인을 접는다(R2-④)
 *   single    경로가 하나: 카드 대신 요약 판, 칸 아래에 붙인다 (R3)
 *   given     서버가 준 경로 수 (기록용)
 */
export function toRouteGuide(routes, options = {}) {
  const given = routes ?? []
  const few = given.filter((r) => transfersOf(r) <= MAX_TRANSFERS)
  const fallback = given.length > 0 && few.length === 0
  const picked = fallback
    ? [...given].sort((a, b) => transfersOf(a) - transfersOf(b)).slice(0, 1)
    : few.slice(0, MAX_ROUTES)
  const views = picked.map((r) => toRouteView(r, options))
  return { routes: views, fallback, single: views.length === 1, given: given.length }
}

/** 도착 시각 = 지금 + 소요 시간. 소요 시간을 모르면 null */
export function arriveAt(route, now = new Date()) {
  if (!Number.isFinite(route.durationMin)) return null
  return new Date(now.getTime() + route.durationMin * 60_000)
}

/** "오후 2:42" (시안 clock) */
export function clockText(date) {
  if (!date) return ''
  const h = date.getHours()
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(date.getMinutes()).padStart(2, '0')}`
}
