// mock 경로 3개. 1순위가 첫 번째. 어느 poi 를 골라도 같은 3개를 돌려준다 (poi-no-route 제외).
// 모양은 디자인 문서 9-2절 형식(legs[], exit, start)이고, 값은 확정 시안의 지하철역 묶음(종로3가역 → 명동역 A·B·C)이다 (8단계).
// 지금 ROUTE_GUIDE 화면은 아직 예전 필드(rank, summary, durationMin, transfers)를 쓰므로 함께 둔다 (9단계에서 legs 로 바꾼다).
// 다른 경우(버스정류장 묶음, 긴 경로, 시험 경우 10가지)는 data/routeCases.js

import { ROUTE_SUBWAY } from './routeCases.js'

const SUMMARY = { A: '지하철 3호선 → 4호선', B: '지하철 1호선 → 4호선', C: '지하철 5호선 → 4호선' }

export const ROUTES = Object.freeze(
  ROUTE_SUBWAY.map((r, i) => ({ ...r, id: `route-${i + 1}`, rank: i + 1, summary: SUMMARY[r.id], transfers: 1 })),
)
