// POST /qr 의 mock. 계획서 4절. 경로를 휴대폰으로 넘길 URL 을 만든다.
// 상태 전이를 일으키지 않는 표시용 조회라서 화면 컴포넌트가 직접 불러도 된다 (계획서 2-3절 예외).
//   시나리오 qrError → Error('QR_ERROR')  (QR 화면에 오류 문구만 표시, 전이 없음)

import { mockDelay } from './mockDelay.js'
import { getScenario, SCENARIOS } from './scenario.js'

export async function createQr(routeId) {
  const scenario = getScenario()
  console.log('[mock] createQr 호출', routeId, scenario)
  await mockDelay()

  if (scenario === SCENARIOS.qrError) throw new Error('QR_ERROR')
  return { url: `https://example.com/r/${encodeURIComponent(routeId)}` }
}
