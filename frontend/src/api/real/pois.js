// GET /api/v1/pois 의 실제 구현. 손으로 고르기 화면의 목적지 목록.
// 서버가 키오스크에서 가까운 지하철역을 가까운 순으로 돌려준다 (임시 규칙. 계획서 6절 1번 '서버 vs 내장' 이 정해지면 바꾼다).
// 실패하면 Error 를 throw 하고, 화면은 "목록을 불러올 수 없어요" 만 보여 준다 (전이 없음).

import { apiFetch, errorMessageOf, KIOSK_ID } from './http.js'
import { toPoi } from './poi.js'

export async function getPois() {
  const body = await apiFetch(`/pois?kiosk_id=${encodeURIComponent(KIOSK_ID)}`)
  if (!body.success) throw new Error(errorMessageOf(body, 'POIS_ERROR'))
  return (body.data?.pois ?? []).map(toPoi)
}
