// 대중교통 경로 조회의 실제 구현. 경로 서버(저장소의 server/app.py)의 GET /routes/transit 을 부르고,
// 받은 경로를 화면이 쓰는 모양으로 바꾼다.
//
// 경로 서버는 출발·도착 좌표를 받는다. 화면은 목적지 id 만 넘기므로 좌표는 이 계층이 채운다.
//   출발지: STT 서버가 POST /location 에서 정해 준 곳 (location.js 가 기억). 아직 없으면 한 번 물어본다.
//   도착지: 앞서 후보로 받은 목적지의 좌표 (poi.js 가 기억)
//
// 서버 응답 → 화면 모양 (mock/route.js 와 같은 { routes: [...] }, 1순위가 첫 번째)
//   200 + 경로 배열  → { routes: [{ id, rank, summary, durationMin, transfers, ... }], summaryText, destination }
//                      순서는 서버가 준 그대로(환승이 적은 순, 같으면 빨리 가는 순)이고, 화면에 맞춰 앞의 3개만 쓴다.
//   200 + 빈 배열    → { routes: [] }            (ROUTING 핸들러가 '가는 길을 찾을 수 없어요' 로 처리)
//   그 밖의 응답      → Error('ROUTE_ERROR')      (카카오맵 조회 실패·키 미설정 등은 500 으로 온다. 화면에는 공통 문구가 나온다)
//   아주 가까운 곳    → 서버를 부르지 않고 Error('가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.')
//   좌표를 모름       → Error('ROUTE_ERROR')
//
// 화면이 지금 쓰는 것은 summary·durationMin·transfers 뿐이지만, 서버가 준 안내 문장도 함께 실어 둔다:
// 경로 전체 요약은 headline, 구간별 안내는 steps[].easyText. 경로 상세 화면을 만들 때 바로 쓸 수 있다.
// '휴대폰으로 보내기'(qr.js)가 쓸 카카오맵 길찾기 주소는 같은 출발·도착지로 여기서 만든다.

import { routeFetch } from './http.js'
import { getLocation, getOrigin } from './location.js'
import { placeOf } from './poi.js'

const MAX_ROUTES = 3
const WALK_ONLY_M = 400 // 직선으로 이보다 가까우면 대중교통 대신 걸어가라고 안내한다

let lastLandingUrl = null

/** 방금 조회한 경로의 카카오맵 길찾기 주소 (qr.js 전용). 없으면 null */
export function getLastLandingUrl() {
  return lastLandingUrl
}

/** 두 지점(경도 x, 위도 y) 사이의 직선 거리(미터) */
function straightMeters(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180
  const dLat = rad(b.y - a.y)
  const dLon = rad(b.x - a.x)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.y)) * Math.cos(rad(b.y)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/** 초 → 분. 서버의 요약 문장과 같은 방식으로 반올림하고, 0초가 아니면 최소 1분 */
function toMinutes(seconds) {
  if (!seconds) return 0
  return Math.max(1, Math.floor((seconds + 30) / 60))
}

const names = (list) => (list ?? []).map((n) => String(n).trim()).filter(Boolean)

/** 한 구간에서 탈 수 있는 차량 중 요약에 적을 하나. '8641(평일)' 처럼 운행 조건이 붙은 것보다 늘 다니는 것을 먼저 고른다 */
function mainVehicle(step) {
  const all = names(step.vehicle_names)
  const plain = all.find((n) => !n.includes('('))
  return (plain ?? all[0] ?? '').replace(/\s*\(.*\)\s*$/, '')
}

/** 목록 화면의 한 줄 요약: '지하철 2호선 → 버스 273번' */
function shortSummary(steps) {
  const parts = []
  for (const s of steps ?? []) {
    const vehicle = mainVehicle(s)
    if (s.type === 'SUBWAY') parts.push(`지하철 ${vehicle.replace(/^수도권\s*/, '')}`.trim())
    else if (s.type === 'BUS') parts.push(`버스 ${/\d$/.test(vehicle) ? `${vehicle}번` : vehicle}`.trim())
  }
  return parts.length > 0 ? parts.join(' → ') : '걸어서 이동'
}

function toStep(s, i, instruction) {
  const stops = names(s.stop_names)
  const riding = s.type === 'BUS' || s.type === 'SUBWAY'
  return {
    order: i + 1,
    mode: s.type,
    minutes: toMinutes(s.duration_seconds),
    distanceM: s.distance_meters ?? null,
    line: mainVehicle(s) || null,
    busType: null,
    board: riding ? (stops[0] ?? null) : null,
    alight: riding && stops.length > 1 ? stops[stops.length - 1] : null,
    stops: riding && stops.length > 1 ? stops.length - 1 : null,
    easyText: instruction ?? '',
  }
}

function toRoute(r, i, poiId) {
  const steps = r.steps ?? []
  return {
    id: `${poiId}#${i + 1}`,
    rank: i + 1,
    summary: shortSummary(steps),
    durationMin: toMinutes(r.duration_seconds),
    transfers: r.transfers ?? 0,
    walkM: steps.filter((s) => s.type === 'WALKING').reduce((sum, s) => sum + (s.distance_meters ?? 0), 0),
    fare: null,
    headline: r.summary ?? '',
    steps: steps.map((s, k) => toStep(s, k, r.instructions?.[k])),
  }
}

const point = (p) => `${encodeURIComponent(p.name || '위치')},${p.y},${p.x}`

export async function route(poiId) {
  lastLandingUrl = null
  const dest = placeOf(poiId)
  if (!dest) throw new Error('ROUTE_ERROR')

  let origin = getOrigin()
  if (!origin) {
    // 첫 화면의 위치 조회가 아직 끝나지 않았거나 실패한 경우. 실패하면 아래에서 ROUTE_ERROR 로 처리한다
    await getLocation().catch(() => {})
    origin = getOrigin()
  }
  if (!origin) throw new Error('ROUTE_ERROR')

  const straight = straightMeters(origin, dest)
  if (straight < WALK_ONLY_M) {
    throw new Error(`가까운 곳이라 걸어서 가실 수 있어요. 약 ${Math.max(10, Math.round(straight / 10) * 10)}미터예요.`)
  }

  const query = new URLSearchParams({
    start_latitude: origin.y,
    start_longitude: origin.x,
    end_latitude: dest.y,
    end_longitude: dest.x,
  })
  const { status, body } = await routeFetch(`/routes/transit?${query}`, { timeoutMs: 12000 })
  if (status !== 200 || !Array.isArray(body)) throw new Error('ROUTE_ERROR')
  if (body.length === 0) return { routes: [] }

  const routes = body.slice(0, MAX_ROUTES).map((r, i) => toRoute(r, i, poiId))
  lastLandingUrl = `https://map.kakao.com/link/by/traffic/${point(origin)}/${point(dest)}`
  return {
    routes,
    summaryText: `${dest.name}까지 가는 길을 ${routes.length}가지 찾았어요.`,
    destination: { poi_id: poiId, name: dest.name, x: dest.x, y: dest.y },
  }
}
