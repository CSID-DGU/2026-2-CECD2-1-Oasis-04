// 대중교통 경로 조회의 실제 구현. 경로 서버(저장소의 server/app.py)의 GET /routes/transit 을 부르고,
// 받은 경로를 화면이 쓰는 모양으로 바꾼다.
//
// 경로 서버는 출발·도착 좌표를 받는다. 화면은 목적지 id 만 넘기므로 좌표는 이 계층이 채운다.
//   출발지: STT 서버가 POST /location 에서 정해 준 곳 (location.js 가 기억). 아직 없으면 한 번 물어본다.
//   도착지: 앞서 후보로 받은 목적지의 좌표 (poi.js 가 기억)
//
// 서버 응답 → 화면 모양 (mock/route.js 와 같은 { routes: [...] }, 1순위가 첫 번째)
//   200 + 경로 배열  → { routes: [{ id, durationMin, exit, start, legs }] }   디자인 문서 9-2절 모양 (바꾸는 규칙·대체 동작은 routeLegs.js)
//                      순서는 서버가 준 그대로(환승이 적은 순, 같으면 빨리 가는 순)이고, 화면에 맞춰 앞의 3개만 쓴다.
//   200 + 빈 배열    → { routes: [] }                     (ROUTING 핸들러가 '가는 길을 찾을 수 없어요' 로 처리)
//   아주 가까운 곳    → 서버를 부르지 않고 ApiError(TOO_CLOSE, '가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.')
//   5xx              → ApiError(UPSTREAM)  그 밖의 응답·좌표를 모름 → ApiError(UNKNOWN)          (오류 코드는 docs/frontend-plan.md 2-3절)
//
// ROUTE_GUIDE 는 이것을 view/routeView.js 로 바꿔 그린다 (9단계). exit 는 서버가 주지 않아 늘 null (#3).
// '휴대폰으로 보내기'(qr.js)가 쓸 카카오맵 길찾기 주소는 같은 출발·도착지로 여기서 만든다.

import { routeFetch } from './http.js'
import { getLocation, getOrigin } from './location.js'
import { placeOf } from './poi.js'
import { ApiError } from '../apiError.js'
import { legsFromSteps, startFromSteps, destinationPlace } from './routeLegs.js'

const MAX_ROUTES = 3
const WALK_ONLY_M = 400 // 직선으로 이보다 가까우면 대중교통 대신 걸어가라고 안내한다

let lastLandingUrl = null
// 서버가 경로마다 휴대폰 주소(landing_url)를 줄 때 경로 id → 주소 (team-requests #7, 11단계)
let landingUrlById = new Map()

/** 마지막으로 찾은 경로의 카카오맵 길찾기 주소 (없으면 null) */
export function getLastLandingUrl() {
  return lastLandingUrl
}

/** 고른 경로의 휴대폰 주소. 서버가 그 경로의 landing_url 을 줬으면 그것, 아니면 마지막 조회의 주소 하나 */
export function landingUrlOf(routeId) {
  return landingUrlById.get(routeId) ?? lastLandingUrl
}

/** 경로 목록과 서버 경로 배열에서 id → landing_url 을 기억한다 (화면 경로 모양에는 넣지 않는다) */
function rememberLandingUrls(routes, serverRoutes) {
  landingUrlById = new Map()
  routes.forEach((r, i) => {
    const url = serverRoutes?.[i]?.landing_url
    if (url) landingUrlById.set(r.id, url)
  })
}

/** 두 지점(경도 x, 위도 y) 사이의 직선 거리(미터) */
function straightMeters(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180
  const dLat = rad(b.y - a.y)
  const dLon = rad(b.x - a.x)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.y)) * Math.cos(rad(b.y)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

/** 예전 GET /api/v1/route 응답의 data → 화면 경로 목록 (DevPanel 의 real 응답 예시가 쓴다) */
export function routesFromV1(data, poiId) {
  const destination = destinationPlace(data?.destination)
  return (data?.routes ?? []).map((r, i) => ({
    id: `${poiId}#${r.rank ?? i + 1}`,
    durationMin: r.total_min,
    exit: null,
    start: startFromSteps(r.steps),
    legs: legsFromSteps(r.steps, { destination }),
  }))
}

/** GET /routes/transit 응답(경로 배열) → 화면 경로 목록 */
export function routesFromTransit(list, poiId, destination) {
  const dest = destinationPlace(destination)
  return (list ?? []).slice(0, MAX_ROUTES).map((r, i) => ({
    id: `${poiId}#${i + 1}`,
    durationMin: r.duration_seconds ? Math.max(1, Math.floor((r.duration_seconds + 30) / 60)) : 0,
    exit: null,
    start: startFromSteps(r.steps),
    legs: legsFromSteps(r.steps, { destination: dest }),
  }))
}

const point = (p) => `${encodeURIComponent(p.name || '위치')},${p.y},${p.x}`

export async function route(poiId) {
  lastLandingUrl = null
  landingUrlById = new Map()
  const dest = placeOf(poiId)
  if (!dest) throw new ApiError('UNKNOWN', null)

  let origin = getOrigin()
  if (!origin) {
    // 첫 화면의 위치 조회가 아직 끝나지 않았거나 실패한 경우. 실패하면 아래에서 UNKNOWN 으로 처리한다
    await getLocation().catch(() => {})
    origin = getOrigin()
  }
  if (!origin) throw new ApiError('UNKNOWN', null)

  const straight = straightMeters(origin, dest)
  if (straight < WALK_ONLY_M) {
    throw new ApiError('TOO_CLOSE', `가까운 곳이라 걸어서 가실 수 있어요. 약 ${Math.max(10, Math.round(straight / 10) * 10)}미터예요.`)
  }

  const query = new URLSearchParams({
    start_latitude: origin.y,
    start_longitude: origin.x,
    end_latitude: dest.y,
    end_longitude: dest.x,
  })
  const { status, body } = await routeFetch(`/routes/transit?${query}`, { timeoutMs: 12000 })
  if (status >= 500) throw new ApiError('UPSTREAM', null) // 카카오맵 조회 실패·키 미설정 등
  if (status !== 200 || !Array.isArray(body)) throw new ApiError('UNKNOWN', null)
  if (body.length === 0) return { routes: [] }

  lastLandingUrl = `https://map.kakao.com/link/by/traffic/${point(origin)}/${point(dest)}`
  const routes = routesFromTransit(body, poiId, { poi_id: poiId, name: dest.name })
  rememberLandingUrls(routes, body)
  return { routes }
}
