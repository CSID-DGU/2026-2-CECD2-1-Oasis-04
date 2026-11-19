// UNAVAILABLE 로 가는 오류의 코드 (docs/frontend-plan.md 2-3절 "오류 모양", 옮기기 계획 4-1절. 이름 확정 2026-11-19).
// reducer 의 state.error 와 RESOLVE_OUT_OF_SCOPE_OR_ERROR·ROUTE_FAILED 의 payload error 는 { code, message } 다.
//   code     아래 여섯 개 중 하나. 화면 그림과 기본 문구는 view/unavailableReason.js 가 고른다
//   message  서버의 쉬운 문장 (있으면). 없으면 null
export const ERROR_CODES = Object.freeze({
  NO_ROUTE: 'NO_ROUTE', // 경로 없음
  TOO_CLOSE: 'TOO_CLOSE', // 가까워서 걸어가면 됨
  OUT_OF_SCOPE: 'OUT_OF_SCOPE', // 안내 범위 밖 (서울 밖 등)
  UPSTREAM: 'UPSTREAM', // 길 안내(카카오)를 받아오지 못함
  NO_POI: 'NO_POI', // 목적지 없이 ROUTING 에 들어옴 (방어)
  UNKNOWN: 'UNKNOWN', // 그 밖 모두 (드문 이유, 네트워크 오류)
})

/** { code, message } 를 만든다. 모르는 코드는 UNKNOWN */
export function kioskError(code, message = null) {
  return { code: ERROR_CODES[code] ?? ERROR_CODES.UNKNOWN, message: message || null }
}
