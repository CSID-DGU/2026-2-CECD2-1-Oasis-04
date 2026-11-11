// real API 공통 도우미. 베이스 URL·키오스크 ID·응답 모양을 한 곳에서 다룬다.
//
// 서버(FastAPI, 저장소의 stt/api.py)의 응답은 모두 같은 모양이다.
//   성공: { success: true,  data: {...}, latency_ms }
//   실패: { success: false, error: { code, message, easy_message }, latency_ms }
// HTTP 상태 코드가 4xx·5xx 여도 본문은 이 모양이므로, 여기서는 본문을 그대로 돌려주고
// 어떤 code 를 어떻게 처리할지는 각 real/*.js 가 정한다.
// 서버에 닿지 못했거나 시간 초과면 Error 를 throw 한다. message 는 'SERVER_UNREACHABLE' 같은 코드라서
// 화면에는 공통 문구가 나오고 (screens/errorMessage.js), 원래 값은 DevPanel 에 남는다.

const env = import.meta.env ?? {}

/** 비워 두면 같은 출처로 요청한다 (개발: vite proxy, 배포: FastAPI 가 빌드 결과물을 함께 서빙) */
const BASE_URL = (env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
const API_PREFIX = '/api/v1'

/** 이 키오스크의 ID. 서버 설정(stt/config.yaml 의 rag.kiosks)에 등록된 값이어야 한다 */
export const KIOSK_ID = env.VITE_KIOSK_ID || 'KIOSK_JONGNO_01'

const DEFAULT_TIMEOUT_MS = 15000

/**
 * 서버를 한 번 호출하고 응답 본문을 돌려준다.
 * @param {string} path '/health' 처럼 /api/v1 뒤에 붙는 경로
 * @param {{ method?: string, json?: unknown, form?: FormData, timeoutMs?: number }} [options]
 */
export async function apiFetch(path, { method = 'GET', json, form, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const init = { method, signal: controller.signal }
  if (json !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(json)
  } else if (form !== undefined) {
    init.body = form // multipart 경계는 브라우저가 붙인다. Content-Type 을 직접 쓰면 안 된다
  }

  let res
  try {
    res = await fetch(`${BASE_URL}${API_PREFIX}${path}`, init)
  } catch (e) {
    // 원래 오류는 cause 에 남긴다 (DevTools 에서 확인용)
    throw new Error(e?.name === 'AbortError' ? 'SERVER_TIMEOUT' : 'SERVER_UNREACHABLE', { cause: e })
  } finally {
    clearTimeout(timer)
  }

  let body
  try {
    body = await res.json()
  } catch {
    throw new Error('SERVER_BAD_RESPONSE')
  }
  // 요청 형식 오류(422) 등 서버 공통 모양이 아닌 응답은 실패 모양으로 맞춘다
  if (typeof body?.success !== 'boolean') {
    return { success: false, error: { code: 'VALIDATION_ERROR', message: JSON.stringify(body) } }
  }
  return body
}

/** 실패 응답에서 화면에 보여 줄 문장을 고른다. 서버가 준 쉬운 문장이 없으면 코드(→ 공통 문구)를 쓴다 */
export function errorMessageOf(body, fallbackCode = 'SERVER_ERROR') {
  return body?.error?.easy_message || fallbackCode
}
