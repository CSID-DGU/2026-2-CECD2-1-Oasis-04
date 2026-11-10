// POST /route 의 mock. 계획서 4절.
//   시나리오 routeError      → Error('ROUTE_ERROR')   (ROUTING 핸들러가 ROUTE_FAILED 로 바꾼다)
//   poiId === 'poi-no-route' → { routes: [] }         (경로 없음. 핸들러가 ROUTE_FAILED 로 바꾼다)
//   그 외                    → { routes: 3개, 1순위가 첫 번째 }

import { mockDelay } from './mockDelay.js'
import { getScenario, SCENARIOS } from './scenario.js'
import { ROUTES } from './data/routes.js'

export async function route(poiId) {
  const scenario = getScenario()
  console.log('[mock] route 호출', poiId, scenario)
  await mockDelay()

  if (scenario === SCENARIOS.routeError) throw new Error('ROUTE_ERROR')
  if (poiId === 'poi-no-route') return { routes: [] }
  return { routes: [...ROUTES] }
}
