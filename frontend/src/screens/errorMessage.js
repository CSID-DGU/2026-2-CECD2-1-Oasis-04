// UNAVAILABLE 화면에 보여 줄 오류 문구를 고르는 표시용 함수. reducer 의 state.error 는 건드리지 않는다.
//
// state.error 에는 두 종류 값이 들어온다.
//   1. 핸들러가 직접 쓴 문장: '경로를 찾지 못했어요', '안내할 수 없는 곳이에요' 등 → 그대로 보여 준다
//   2. API 가 throw 한 Error 의 message 코드: 'STT_ERROR', 'SERVER_ERROR', 'ROUTE_ERROR' 등 → 사용자에게는 의미가 없으므로
//      공통 문구로 바꾼다. 원래 코드는 DevPanel 의 error 줄에 그대로 남는다 (디버깅용)
// 값이 없을 때(null·빈 문자열. DevPanel 로 payload 없이 들어온 경우)도 공통 문구를 보여 준다.

export const GENERIC_ERROR_MESSAGE = '잠시 문제가 생겼어요. 손으로 고르시거나 처음부터 다시 해 주세요'

/** 'STT_ERROR', 'ROUTE_ERROR', 'E42' 처럼 대문자·숫자·밑줄로만 된 값을 "오류 코드" 로 본다. */
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/

export function isErrorCode(value) {
  return typeof value === 'string' && ERROR_CODE_PATTERN.test(value.trim())
}

/** 화면에 보여 줄 문구. 문장이면 그대로, 코드이거나 비어 있으면 공통 문구. */
export function toDisplayMessage(error) {
  if (typeof error !== 'string' || error.trim() === '') return GENERIC_ERROR_MESSAGE
  if (isErrorCode(error)) return GENERIC_ERROR_MESSAGE
  return error
}
