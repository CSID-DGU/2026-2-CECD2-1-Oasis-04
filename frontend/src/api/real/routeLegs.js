// 서버 경로의 단계(steps[]) → 화면 경로 모양의 구간(legs[], 디자인 문서 9-2절). 순수 함수 (테스트: __tests__/routeLegs.test.js).
//
// 두 가지 서버 모양을 모두 받는다 (2026-11-20 확인, 계획서 4-1절 아래 '경로 응답 모양')
//   ① 지금 이 브랜치의 GET /api/v1/route (server/routing.py)
//      { mode: 'WALK'|'BUS'|'SUBWAY', minutes, distance_m, line, bus_type, board, alight, stops, easy_text }
//   ② feature/backend-route 의 GET /routes/transit (server/kakao_transit.py)
//      { type: 'WALKING'|'BUS'|'SUBWAY', duration_seconds, distance_meters, stop_names[], vehicle_names[], guidance }
//
// 서버가 주지 않는 값의 대체 동작 (docs/team-requests.md)
//   lineId  서버가 line_id 를 주면 그것. 없으면 노선 이름으로 정한다 (2026-11-22, #2): "3호선"·"수도권 3호선" → "seoul-3",
//           "공항철도" → "arex" 등 (subwayLineId. 값은 위치 응답의 lines[].lineId, kb/station_lines.py 와 같다).
//           "인천 1호선" 처럼 다른 지역 이름이 붙은 노선과 모르는 이름은 null → 회색
//   label   노선 이름 글자에서 만든다: "3호선"·"수도권 3호선" → "3" (원), 그 밖은 "수도권 " 만 떼고 그대로 ("공항철도" → 평평한 표지)
//   kind    ① 의 bus_type 한글("간선" 등)을 TRUNK 등으로. ② 는 따로 주지 않아서 카카오 안내 문구의 앞머리로 정한다 (2026-11-22, #6):
//           guidance "간선 271외 7대 (종로3가 > 충정로역)" → 간선 → TRUNK.
//           경기버스는 일반 → GG_GENERAL, 좌석 → GG_SEAT, 직행 → GG_DIRECT (경기버스 색으로 칠한다).
//           문구의 번호가 화면에 쓰는 번호와 다르거나, 시외처럼 색을 정하지 않은 종류면 null → 회색 "그 밖"
//           (종류별 색은 view/routeView.js 의 BUS_KIND_COLORS: 간선·지선·광역·순환, 마을은 지선과 같은 초록,
//            경기 일반 초록·좌석 파랑·직행 빨강. 공항·심야는 회색)
//   number  ① line. ② 는 vehicle_names 중 "(평일)" 같은 조건이 없는 첫 번호, 없으면 첫 번호 (같은 구간의 다른 버스는 쓰지 않는다, 계획서 6-1절 #11)
//   stops   ① stops. ② stop_names 개수 - 1 (#5, 맞는지 확인 필요)
//   to      내리는 곳 이름 (① alight, ② stop_names 마지막). 지하철은 끝에 "역" 을 붙여 STATION, 버스는 STOP
//   걷기 to 다음 차를 타는 곳이 앞 차에서 내린 곳과 다르면 그곳(STATION/STOP). 같은 이름·같은 종류면 없음(같은 역 안 환승)
//           마지막 차 뒤 걷기는 목적지 { name, kind } 까지 (#4. 서버가 줄 때만 있다)
//   minutes ① minutes. ② duration_seconds 를 분으로 올림 (1분 미만도 1분)

// 카카오가 일반·좌석·직행이라고 주는 것은 경기도 시내버스의 종류(일반형·좌석형·직행좌석형)다 → 경기버스 색 (2026-11-22)
const BUS_KINDS_KO = {
  간선: 'TRUNK',
  지선: 'BRANCH',
  광역: 'EXPRESS',
  순환: 'CIRCULAR',
  마을: 'VILLAGE',
  심야: 'NIGHT',
  공항: 'AIRPORT',
  일반: 'GG_GENERAL',
  좌석: 'GG_SEAT',
  직행: 'GG_DIRECT',
}

// 번호가 아닌 이름으로 부르는 수도권 노선 → 노선 ID (kb/station_lines.py 의 LINES 와 같은 값)
const LINE_ID_BY_NAME = {
  공항철도: 'arex',
  경의중앙선: 'gyeongui-jungang',
  수인분당선: 'suin-bundang',
  'GTX-A': 'gtx-a',
  경춘선: 'gyeongchun',
  신분당선: 'sinbundang',
  우이신설선: 'ui-sinseol',
  신림선: 'sillim',
  김포골드라인: 'gimpo-gold',
  서해선: 'seohae',
  경강선: 'gyeonggang',
}

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

/** 지하철 노선 이름 → 노선 ID. 서울 1~9호선과 이름으로 부르는 수도권 노선만 알고, 그 밖은 null (색을 넣지 않는다) */
export function subwayLineId(name) {
  const n = clean(name).replace(/^수도권\s*/, '')
  const num = n.match(/^([1-9])호선$/)
  return num ? `seoul-${num[1]}` : (LINE_ID_BY_NAME[n] ?? null)
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

/** 카카오 안내 문구 "간선 271외 7대 (종로3가 > 충정로역)" → { type: '간선', number: '271' }. 그런 모양이 아니면 null */
function guidanceBus(guidance) {
  const m = String(guidance ?? '').match(/^(\S+)\s+(.+?)(?:외\s*\d+대)?\s*\(/)
  return m ? { type: m[1], number: m[2].trim() } : null
}

/**
 * 버스 종류: 서버가 준 bus_type, 없으면 안내 문구의 앞머리.
 * 문구의 종류는 문구에 적힌 첫 버스의 것이라, 화면에 쓰는 번호(number)가 그 버스일 때만 쓴다
 * (첫 버스가 "(평일)" 같은 조건이 붙어 다른 번호를 고른 경우에는 종류를 모른다 → null)
 */
function busKindOf(s, number) {
  const given = busKind(s.bus_type)
  if (given) return given
  const g = guidanceBus(s.guidance)
  return g && clean(g.number) === clean(number) ? busKind(g.type) : null
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
    return { mode, lineId: s.line_id ?? subwayLineId(name), label: subwayLabel(name), stops: stopsOf(s), to }
  }
  const number = busNumber(s)
  return { mode, kind: busKindOf(s, number), number, stops: stopsOf(s), to }
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
