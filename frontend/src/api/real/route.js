// GET /api/v1/route 의 실제 구현. 키오스크에서 목적지까지의 대중교통 경로를 받아 화면이 쓰는 모양으로 바꾼다.
// 서버(server/app.py)가 카카오맵 대중교통 경로를 받아 환승·도보가 적은 순으로 다시 줄 세워 최대 3개를 준다.
//
// 서버 응답 → 화면 모양 (mock/route.js 와 같은 { routes: [...] }, 1순위가 첫 번째)
//   성공                 → { routes: [{ id, rank, summary, durationMin, transfers, ... }] }
//   실패 ROUTE_NOT_FOUND → { routes: [] }          (ROUTING 핸들러가 '가는 길을 찾을 수 없어요' 로 처리)
//   실패 ROUTE_TOO_CLOSE → Error(서버의 쉬운 문장)   (예: '가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.')
//   그 밖의 실패          → Error(서버의 쉬운 문장 또는 ROUTE_ERROR)
//
// 화면이 지금 쓰는 것은 summary·durationMin·transfers 뿐이지만, 단계별 쉬운 문장(steps[].easyText)과
// 요금·도보 거리도 함께 실어 둔다. 경로 상세 화면을 만들 때 바로 쓸 수 있다.
// 서버가 준 카카오맵 길찾기 주소(landing_url)는 '휴대폰으로 보내기'(qr.js)가 쓰도록 기억해 둔다.

import { apiFetch, errorMessageOf, KIOSK_ID } from './http.js'

let lastLandingUrl = null

/** 방금 조회한 경로의 카카오맵 길찾기 주소 (qr.js 전용). 없으면 null */
export function getLastLandingUrl() {
  return lastLandingUrl
}

function toStep(s) {
  return {
    order: s.order,
    mode: s.mode,
    minutes: s.minutes,
    distanceM: s.distance_m ?? null,
    line: s.line ?? null,
    busType: s.bus_type ?? null,
    board: s.board ?? null,
    alight: s.alight ?? null,
    stops: s.stops ?? null,
    easyText: s.easy_text ?? '',
  }
}

export async function route(poiId) {
  lastLandingUrl = null
  const query = `kiosk_id=${encodeURIComponent(KIOSK_ID)}&dest_poi_id=${encodeURIComponent(poiId)}`
  const body = await apiFetch(`/route?${query}`, { timeoutMs: 12000 })

  if (!body.success) {
    if (body.error?.code === 'ROUTE_NOT_FOUND') return { routes: [] }
    throw new Error(errorMessageOf(body, 'ROUTE_ERROR'))
  }

  const d = body.data ?? {}
  lastLandingUrl = d.landing_url ?? null
  const routes = (d.routes ?? []).map((r) => ({
    id: `${poiId}#${r.rank}`,
    rank: r.rank,
    summary: r.summary ?? '',
    durationMin: r.total_min,
    transfers: r.transfers,
    walkM: r.walk_m ?? null,
    fare: r.fare ?? null,
    headline: r.headline ?? '',
    steps: (r.steps ?? []).map(toStep),
  }))
  return { routes, summaryText: d.summary_text ?? '', destination: d.destination ?? null }
}
