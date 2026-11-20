// mock 경로 3개. 1순위가 첫 번째. 어느 poi 를 골라도 같은 3개를 돌려준다 (poi-no-route 제외).
// 모양은 디자인 문서 9-2절 형식(legs[], exit, start)이고, 값은 확정 시안의 지하철역 묶음(종로3가역 → 명동역 A·B·C)이다 (8단계).
// 예전 필드(rank, summary, transfers)는 9단계에서 지웠다. 환승 횟수는 화면이 구간으로 센다 (view/routeView.js)
// 다른 경우(버스정류장 묶음, 긴 경로, 시험 경우 10가지)는 data/routeCases.js

import { ROUTE_SUBWAY } from './routeCases.js'

export const ROUTES = Object.freeze(ROUTE_SUBWAY.map((r, i) => ({ ...r, id: `route-${i + 1}` })))
