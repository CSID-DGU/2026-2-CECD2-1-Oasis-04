// GET /health 의 mock. 계획서 4절.
//   normal     → { server: true,  stt: true }
//   serverDown → { server: false, stt: true }   (STARTUP_CHECK 핸들러가 HEALTH_SERVER_DOWN 으로 바꾼다)
//   sttDown    → { server: true,  stt: false }  (MIC_OR_STT_UNAVAILABLE)
//   그 외 시나리오는 health 와 무관하므로 정상 응답
// 호출마다 console.log 를 찍는다: StrictMode 에서 effect 가 두 번 돌 때 호출이 몇 번인지 눈으로 확인하는 용도.

import { mockDelay } from './mockDelay.js'
import { getScenario, SCENARIOS } from './scenario.js'

export async function health() {
  const scenario = getScenario()
  console.log('[mock] health 호출', scenario)
  await mockDelay()

  if (scenario === SCENARIOS.serverDown) return { server: false, stt: true }
  if (scenario === SCENARIOS.sttDown) return { server: true, stt: false }
  return { server: true, stt: true }
}
