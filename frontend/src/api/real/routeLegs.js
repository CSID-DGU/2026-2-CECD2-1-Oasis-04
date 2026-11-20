// 서버 경로의 단계(steps[]) → 화면 경로 모양의 구간(legs[], 디자인 문서 9-2절). 순수 함수 (테스트: __tests__/routeLegs.test.js).
//
// 두 가지 서버 모양을 모두 받는다 (2026-11-20 확인, 계획서 4-1절 아래 '경로 응답 모양')
//   ① 지금 이 브랜치의 GET /api/v1/route (server/routing.py)
//      { mode: 'WALK'|'BUS'|'SUBWAY', minutes, distance_m, line, bus_type, board, alight, stops, easy_text }
//   ② feature/backend-route 의 GET /routes/transit (server/kakao_transit.py)
//      { type: 'WALKING'|'BUS'|'SUBWAY', duration_seconds, distance_meters, stop_names[], vehicle_names[], guidance }
//
// 서버가 주지 않는 값의 대체 동작 (docs/team-requests.md)
//   lineId  늘 null → 노선 원 테두리는 회색 (#2). 색을 노선 이름으로 짐작하지 않는다 (디자인 문서 3-6절)
//   label   노선 이름 글자에서 만든다: "3호선"·"수도권 3호선" → "3" (원), 그 밖은 "수도권 " 만 떼고 그대로 ("공항철도" → 평평한 표지)
//   kind    ① 의 bus_type 한글("간선" 등)을 TRUNK 등으로. ② 는 주지 않으므로 null → 회색 "그 밖" (#6)
//   number  ① line. ② 는 vehicle_names 중 "(평일)" 같은 조건이 없는 첫 번호, 없으면 첫 번호 (같은 구간의 다른 버스는 쓰지 않는다, 계획서 6-1절 #11)
//   stops   ① stops. ② stop_names 개수 - 1 (#5, 맞는지 확인 필요)
//   to      내리는 곳 이름 (① alight, ② stop_names 마지막). 지하철은 끝에 "역" 을 붙여 STATION, 버스는 STOP
//   걷기 to 다음 차를 타는 곳이 앞 차에서 내린 곳과 다르면 그곳(STATION/STOP). 같은 이름·같은 종류면 없음(같은 역 안 환승)
//           마지막 차 뒤 걷기는 목적지 { name, kind } 까지 (#4. 서버가 줄 때만 있다)
//   minutes ① minutes. ② duration_seconds 를 분으로 올림 (1분 미만도 1분)

const BUS_KINDS_KO = { 간선: 'TRUNK', 지선: 'BRANCH', 광역: 'EXPRESS', 순환: 'CIRCULAR', 마을: 'VILLAGE', 심야: 'NIGHT', 공항: 'AIRPORT' }

const modeOf = (s) => {
  const m = s.mode ?? s.type
  return m === 'WALKING' ? 'WALK' : m
}

const minutesOf = (s) =>
  Number.isFinite(s.minutes) ? s.minutes : Number.isFinite(s.duration_seconds) ? Math.max(1, Math.ceil(s.duration_seconds / 60)) : null

const clean = (name) => String(name ?? '').replace(/\s*\(.*?\)/g, '').trim()

/** 지하철 노선 이름 → 표지 글자 */
export function subwayLabel(name) {
  const n = clean(name).replace(/^수도권\s*/, '')
  const num = n.match(/^(\d+)호선$/)
  return num ? num[1] : n || '지하철'
}

/** 버스 종류 글자(서버 bus_type) → TRUNK 등. 이미 영문 값이면 그대로, 모르면 null */
export function busKind(type) {
  if (!type) return null
  const t = String(type).trim()
  if (Object.values(BUS_KINDS_KO).includes(t.toUpperCase())) return t.toUpperCase()
  const key = Object.keys(BUS_KINDS_KO).find((k) => t.startsWith(k))
  return key ? BUS_KINDS_KO[key] : null
}

function busNumber(s) {
  if (s.line) return String(s.line).replace(/번$/, '')
  const names = (s.vehicle_names ?? []).map(String).filter(Boolean)
  return (names.find((n) => !/\(/.test(n)) ?? names[0] ?? '').replace(/번$/, '')
}

const stationName = (name) => (name && !/역$/.test(name) ? `${name}역` : name)
const placeOf = (mode, name) => (name ? (mode === 'SUBWAY' ? { name: stationName(name), kind: 'STATION' } : { name, kind: 'STOP' }) : null)

function boardOf(s) {
  return clean(s.board ?? s.stop_names?.[0])
}
function alightOf(s) {
  const names = s.stop_names ?? []
  return clean(s.alight ?? names[names.length - 1])
}
function stopsOf(s) {
  if (Number.isInteger(s.stops)) return s.stops
  if (Array.isArray(s.stop_names) && s.stop_names.length >= 2) return s.stop_names.length - 1
  return null
}

function rideLeg(s, mode) {
  const to = placeOf(mode, alightOf(s))
  if (mode === 'SUBWAY') {
    const name = s.line ?? s.vehicle_names?.[0]
    return { mode, lineId: null, label: subwayLabel(name), stops: stopsOf(s), to }
  }
  return { mode, kind: busKind(s.bus_type), number: busNumber(s), stops: stopsOf(s), to }
}

const samePlace = (a, b) => !!a && !!b && a.kind === b.kind && a.name === b.name

/**
 * steps → legs
 * destination: 목적지 { name, kind } (마지막 차 뒤 걷기의 도착점). 없으면 마지막 걷기는 to 없음
 */
export function legsFromSteps(steps, { destination = null } = {}) {
  const list = (steps ?? []).filter((s) => ['WALK', 'BUS', 'SUBWAY'].includes(modeOf(s)))
  const legs = list.map((s) => (modeOf(s) === 'WALK' ? { mode: 'WALK', minutes: minutesOf(s) } : rideLeg(s, modeOf(s))))
  legs.forEach((leg, i) => {
    if (leg.mode !== 'WALK') return
    const prev = legs.slice(0, i).reverse().find((l) => l.mode !== 'WALK') ?? null
    const nextIndex = legs.findIndex((l, k) => k > i && l.mode !== 'WALK')
    if (nextIndex < 0) {
      if (destination?.name) leg.to = destination
      return
    }
    const board = placeOf(legs[nextIndex].mode, boardOf(list[nextIndex]))
    if (board && !samePlace(board, prev?.to)) leg.to = board
  })
  return legs
}

/** 출발 장소: 첫 구간이 차면 그 차를 타는 곳. 먼저 걸으면 null (화면이 지금 계신 곳으로 채운다, view/routeView.js) */
export function startFromSteps(steps) {
  const list = (steps ?? []).filter((s) => ['WALK', 'BUS', 'SUBWAY'].includes(modeOf(s)))
  const first = list[0]
  if (!first || modeOf(first) === 'WALK') return null
  return placeOf(modeOf(first), boardOf(first))
}

/** 목적지 종류: poi 종류나 id 로 역(SUB_)·정류장(BUS_)을 가리고, 그 밖은 장소 (R7) */
export function destinationPlace(destination) {
  if (!destination?.name) return null
  const id = String(destination.poi_id ?? '')
  const type = String(destination.poi_type ?? '').toUpperCase()
  const kind = type === 'SUBWAY' || id.startsWith('SUB_') ? 'STATION' : type === 'BUS' || id.startsWith('BUS_') ? 'STOP' : 'PLACE'
  return { name: destination.name, kind }
}
