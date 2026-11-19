// GET /api/v1/route 의 실제 구현. 키오스크에서 목적지까지의 대중교통 경로를 받아 화면이 쓰는 모양으로 바꾼다.
// 서버(server/app.py)가 카카오맵 대중교통 경로를 받아 환승·도보가 적은 순으로 다시 줄 세워 최대 3개를 준다.
//
// 서버 응답 → 화면 모양 (mock/route.js 와 같은 { routes: [...] }, 1순위가 첫 번째)
//   성공                 → { routes: [{ id, durationMin, exit, start, legs }] }   디자인 문서 9-2절 모양 (바꾸는 규칙·대체 동작은 routeLegs.js)
//   실패 ROUTE_NOT_FOUND → { routes: [] }          (ROUTING 핸들러가 '가는 길을 찾을 수 없어요' 로 처리)
//   실패 ROUTE_TOO_CLOSE → ApiError(TOO_CLOSE, 서버의 쉬운 문장)   (예: '가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.')
//   실패 UPSTREAM_ERROR  → ApiError(UPSTREAM, 서버의 쉬운 문장)
//   그 밖의 실패          → ApiError(UNKNOWN, 서버의 쉬운 문장 또는 null)   (오류 코드는 docs/frontend-plan.md 2-3절)
//
// ROUTE_GUIDE 는 이것을 view/routeView.js 로 바꿔 그린다 (9단계). exit 는 서버가 필드로 주지 않아 늘 null (#3).
// 서버가 주는 summary·headline·요금·단계별 쉬운 문장(easy_text)은 화면이 쓰지 않아 옮기지 않는다 (9단계에서 지움).
// 서버가 준 카카오맵 길찾기 주소(landing_url)는 '휴대폰으로 보내기'(qr.js)가 쓰도록 기억해 둔다.

import { apiFetch, KIOSK_ID } from './http.js'
import { ApiError } from '../apiError.js'
import { legsFromSteps, startFromSteps, destinationPlace } from './routeLegs.js'

// 서버 오류 코드 → 앱 오류 코드 (ROUTE_NOT_FOUND 는 빈 경로로 돌려주므로 여기 없다)
const ROUTE_ERROR_CODES = { ROUTE_TOO_CLOSE: 'TOO_CLOSE', UPSTREAM_ERROR: 'UPSTREAM' }

let lastLandingUrl = null

/** 방금 조회한 경로의 카카오맵 길찾기 주소 (qr.js 전용). 없으면 null */
export function getLastLandingUrl() {
  return lastLandingUrl
}

/** 서버 응답의 data → 화면 경로 목록 (DevPanel 의 real 응답 예시도 이것을 쓴다) */
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

export async function route(poiId) {
  lastLandingUrl = null
  const query = `kiosk_id=${encodeURIComponent(KIOSK_ID)}&dest_poi_id=${encodeURIComponent(poiId)}`
  const body = await apiFetch(`/route?${query}`, { timeoutMs: 12000 })

  if (!body.success) {
    if (body.error?.code === 'ROUTE_NOT_FOUND') return { routes: [] }
    throw new ApiError(ROUTE_ERROR_CODES[body.error?.code] ?? 'UNKNOWN', body.error?.easy_message || null)
  }

  const d = body.data ?? {}
  lastLandingUrl = d.landing_url ?? null
  return { routes: routesFromV1(d, poiId) }
}
