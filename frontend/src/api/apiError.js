// API 가 throw 하는 오류. code 는 state/errorCodes.js 의 코드, easyMessage 는 서버의 쉬운 문장(없으면 null).
// Error.message 는 쉬운 문장이 있으면 그것, 없으면 code 라서 예전처럼 e.message 로 읽어도 뜻이 통한다.
// 핸들러는 toKioskError(e) 로 reducer 에 넣을 { code, message } 를 만든다.
import { ERROR_CODES, kioskError } from '../state/errorCodes.js'

export class ApiError extends Error {
  constructor(code, easyMessage = null) {
    super(easyMessage || code)
    this.name = 'ApiError'
    this.code = code
    this.easyMessage = easyMessage || null
  }
}

/** 잡은 오류 → { code, message }. ApiError 가 아니면(네트워크 오류, mock 의 Error('ROUTE_ERROR') 등) UNKNOWN */
export function toKioskError(e) {
  if (e instanceof ApiError) return kioskError(e.code, e.easyMessage)
  return kioskError(ERROR_CODES.UNKNOWN, typeof e?.message === 'string' ? e.message : null)
}
