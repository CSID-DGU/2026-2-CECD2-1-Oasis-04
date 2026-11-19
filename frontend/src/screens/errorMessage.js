// UNAVAILABLE 오류 문구 (화면 쪽 이름). 실제 규칙은 view/unavailableReason.js 에 있다 (4단계에서 옮김).
//
// state.error 는 { code, message } 다 (docs/frontend-plan.md 2-3절). message 에는 두 종류가 올 수 있다.
//   1. 서버나 핸들러의 문장: '가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.' 등 → 그대로 보여 준다
//   2. 'SERVER_TIMEOUT', 'ROUTE_ERROR' 같은 코드 모양 (네트워크 오류, mock) → 사용자에게는 뜻이 없으므로 코드별 기본 문구
// 원래 값은 reducer 에 그대로 있고 DevPanel 의 error 줄에서 볼 수 있다.

import { reasonOf } from '../view/unavailableReason.js'

export { GENERIC_ERROR_MESSAGE, isErrorCode } from '../view/unavailableReason.js'

/** 화면에 보여 줄 문구 전체 (첫 문장 + 나머지). error 가 없거나 모양이 틀려도 공통 문구 */
export function toDisplayMessage(error) {
  return reasonOf(error).text
}
