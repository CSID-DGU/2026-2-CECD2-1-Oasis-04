// GET /pois 의 mock. 계획서 4절. 손으로 고르기 화면의 목적지 목록.
// 상태 전이를 일으키지 않는 표시용 조회라서 화면 컴포넌트가 직접 불러도 된다 (계획서 2-3절 예외).
//   시나리오 poisError → Error('POIS_ERROR')  (화면에 "목록을 불러올 수 없어요" 만 표시, 전이 없음)

import { mockDelay } from './mockDelay.js'
import { getScenario, SCENARIOS } from './scenario.js'
import { POIS } from './data/pois.js'

export async function getPois() {
  const scenario = getScenario()
  console.log('[mock] getPois 호출', scenario)
  await mockDelay()

  if (scenario === SCENARIOS.poisError) throw new Error('POIS_ERROR')
  return [...POIS]
}
