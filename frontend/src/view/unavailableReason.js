// UNAVAILABLE 의 이유: 오류 코드 → 고리 가운데 그림과 문구 (디자인 문서 12-3절, 시안 unavailable-final.html 의 REASONS).
//   NO_ROUTE      깃발      가는 길을 찾을 수 없어요
//   TOO_CLOSE     걷는 사람  서버 문장 (예: 가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.)
//   OUT_OF_SCOPE  지도 핀    이 키오스크에서 안내할 수 없는 곳이에요 (앱 문구. team-requests #8)
//   UPSTREAM      시계      서버 문장 (지금은 길 안내를 받아올 수 없어요. 잠시 후 다시 해 주세요.)
//   NO_POI        시계      목적지가 정해지지 않았어요 (드문 이유)
//   UNKNOWN       시계      서버 문장이 있으면 그것(드문 이유 9가지), 없으면 공통 문구
// 문구: message 가 문장이면 그것, 비었거나 오류 코드 모양이면 코드별 기본 문구. 글자는 바꾸지 않는다.
// 화면에서는 첫 ". " 뒤에서 나눠 첫 문장만 크게(오류 색), 나머지는 본문 크기로 보인다 (splitFirstSentence).

import { ERROR_CODES } from '../state/errorCodes.js'

/** 공통 오류 문구 (드문 이유이거나 문장이 없을 때) */
export const GENERIC_ERROR_MESSAGE = '잠시 문제가 생겼어요. 손으로 고르시거나 처음부터 다시 해 주세요'

/** 'STT_ERROR', 'ROUTE_ERROR', 'E42' 처럼 대문자·숫자·밑줄로만 된 값을 "오류 코드" 로 본다 */
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/

export function isErrorCode(value) {
  return typeof value === 'string' && ERROR_CODE_PATTERN.test(value.trim())
}

const REASONS = {
  [ERROR_CODES.NO_ROUTE]: { icon: 'flag', text: '가는 길을 찾을 수 없어요' },
  [ERROR_CODES.TOO_CLOSE]: { icon: 'walk', text: '가까운 곳이라 걸어서 가실 수 있어요.' },
  [ERROR_CODES.OUT_OF_SCOPE]: { icon: 'pin', text: '이 키오스크에서 안내할 수 없는 곳이에요' },
  [ERROR_CODES.UPSTREAM]: { icon: 'clock', text: '지금은 길 안내를 받아올 수 없어요. 잠시 후 다시 해 주세요.' },
  [ERROR_CODES.NO_POI]: { icon: 'clock', text: '목적지가 정해지지 않았어요' },
  [ERROR_CODES.UNKNOWN]: { icon: 'clock', text: GENERIC_ERROR_MESSAGE },
}

function isSentence(message) {
  return typeof message === 'string' && message.trim() !== '' && !isErrorCode(message)
}

/** error({ code, message }) → { code, icon, text }. 예전 모양(문자열)이나 null 도 받는다 */
export function reasonOf(error) {
  const obj = typeof error === 'string' ? { code: ERROR_CODES.UNKNOWN, message: error } : (error ?? {})
  const code = REASONS[obj.code] ? obj.code : ERROR_CODES.UNKNOWN
  const reason = REASONS[code]
  return { code, icon: reason.icon, text: isSentence(obj.message) ? obj.message.trim() : reason.text }
}

/** 첫 ". " 뒤에서 나눈다. 없으면 전체가 첫 문장 → [첫 문장, 나머지('' 일 수 있음)] */
export function splitFirstSentence(text) {
  const cut = text.indexOf('. ')
  return cut < 0 ? [text, ''] : [text.slice(0, cut + 1), text.slice(cut + 2)]
}
