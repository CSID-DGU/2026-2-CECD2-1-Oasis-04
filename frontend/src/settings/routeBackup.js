// 경로 찾기 설정. 설정 페이지의 '경로' 탭(RouteTab.jsx)에서 바꾸고 브라우저에 저장한다.
//
// 경로는 경로 서버(server/app.py)가 카카오맵으로 찾고, 카카오맵이 실패하면 같은 서버가 ODsay 로 한 번 더 찾는다
// (server/odsay_transit.py). 화면은 어떤 방식으로 찾을지만 GET /routes/transit 의 provider 값으로 알린다.
//   'auto'  카카오 먼저, 실패하면 ODsay. 처음 값이고 서버의 기본 동작이라 provider 를 넘기지 않는다
//           서버에 ODsay 키가 없으면 백업 없이 예전처럼 안내 불가 화면이 된다
//   'only'  ODsay 로만 찾는다 (provider=odsay. 백업이 잘 되는지 볼 때. 무료 요금제가 하루 30회라 평소에는 쓰지 않는다)
//   'off'   백업을 쓰지 않는다 (provider=kakao)
// api/real/route.js 가 경로를 찾을 때마다 이 값을 읽으므로 저장하면 바로 쓰인다.
//
// 남은 횟수: 카카오맵과 ODsay 모두 응답에 남은 횟수를 알려 주지 않는다. 경로 서버가 켜진 뒤 직접 센 횟수(GET /routes/status)로
// 계산하므로, 서버를 다시 띄우면 0 부터 세고 같은 키를 다른 곳에서 쓴 횟수는 들어가지 않는다.

import { routeFetch } from '../api/real/http.js'

export const ROUTE_BACKUP_KEY = 'oasis.routeBackup'
/** 설정 탭에 보이는 순서 */
export const BACKUP_MODES = Object.freeze(['auto', 'only', 'off'])
export const DEFAULT_BACKUP_MODE = 'auto'

const PROVIDER_OF_MODE = Object.freeze({ auto: null, off: 'kakao', only: 'odsay' })

/** 설정 값 → GET /routes/transit 의 provider 값. 넘기지 않아도 되면 null */
export function providerOf(mode) {
  return PROVIDER_OF_MODE[mode] ?? null
}

const defaultStorage = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null // 저장소를 막아 둔 브라우저
  }
}

/** 저장된 값. 없거나 모르는 값이면 처음 값 */
export function readRouteBackup(storage = defaultStorage()) {
  try {
    const value = storage?.getItem(ROUTE_BACKUP_KEY)
    return BACKUP_MODES.includes(value) ? value : DEFAULT_BACKUP_MODE
  } catch {
    return DEFAULT_BACKUP_MODE
  }
}

/** 저장한다. 처음 값이면 저장된 값을 지운다. 저장하지 못하면 false */
export function writeRouteBackup(mode, storage = defaultStorage()) {
  try {
    if (!BACKUP_MODES.includes(mode)) return false
    if (mode === DEFAULT_BACKUP_MODE) storage?.removeItem(ROUTE_BACKUP_KEY)
    else storage?.setItem(ROUTE_BACKUP_KEY, mode)
    return Boolean(storage)
  } catch {
    return false
  }
}

/** 길찾기 제공자. name 은 화면에 쓰는 이름, subject 는 문장의 주어("…이/가"), keyName 은 경로 서버의 환경변수 */
export const PROVIDERS = Object.freeze({
  kakao: { name: '카카오맵', subject: '카카오맵이', keyName: 'KAKAO_REST_API_KEY' },
  odsay: { name: 'ODsay', subject: 'ODsay 가', keyName: 'ODSAY_API_KEY' },
})

const UNREACHABLE = Object.freeze({ reachable: false, kakao: null, odsay: null })

const usageOf = (p) => (p ? { configured: Boolean(p.configured), usedToday: p.used_today ?? null, dailyLimit: p.daily_limit ?? null } : null)

/**
 * 경로 서버에 제공자 상태를 묻는다 (GET /routes/status). 실패해도 throw 하지 않는다.
 * @returns {Promise<{ reachable: boolean, kakao: object|null, odsay: object|null }>}
 *   kakao·odsay 는 { configured, usedToday, dailyLimit }. 상태 주소가 없는 예전 경로 서버는 닿지만 둘 다 null 이다
 */
export async function probeRoutes({ timeoutMs = 2500 } = {}) {
  try {
    const { status, body } = await routeFetch('/routes/status', { timeoutMs })
    if (status >= 500) return UNREACHABLE // 개발 서버의 proxy 는 경로 서버가 꺼져 있으면 5xx 를 준다
    if (status !== 200 || !body) return { reachable: true, kakao: null, odsay: null }
    return { reachable: true, kakao: usageOf(body.kakao), odsay: usageOf(body.odsay) }
  } catch {
    return UNREACHABLE
  }
}

/** 남은 횟수. 모르면 null */
export function leftOf(usage) {
  if (!usage || usage.usedToday === null || usage.dailyLimit === null) return null
  return Math.max(0, usage.dailyLimit - usage.usedToday)
}

/** probeRoutes 결과 → 설정 탭의 제공자 한 줄. status 가 null 이면 아직 확인 중 */
export function providerStatusText(provider, status) {
  if (!status) return '서버를 확인하는 중입니다'
  if (!status.reachable) return '경로 서버가 응답하지 않습니다'
  const usage = status[provider]
  if (!usage) return '이 경로 서버는 상태를 알려 주지 않습니다'
  if (!usage.configured) return `키가 없습니다. 경로 서버를 띄울 때 환경변수 ${PROVIDERS[provider].keyName} 를 넘겨 주세요`
  const left = leftOf(usage)
  if (left === null) return '키 있음'
  return `키 있음 · 오늘 ${usage.usedToday}회 사용 · 남은 횟수 ${left}회 (하루 ${usage.dailyLimit.toLocaleString('ko-KR')}회)`
}

/** 그 제공자를 쓸 수 없는 상태인가 (설정 탭에서 붉게 보인다) */
export function providerOff(provider, status) {
  return Boolean(status) && !(status.reachable && status[provider]?.configured)
}

// 연결 확인에 쓰는 구간: 종로3가역 → 서울역
const TEST_TRIP = Object.freeze({ from: '종로3가역', to: '서울역', start: { x: 126.9918, y: 37.5704 }, end: { x: 126.9707, y: 37.5547 } })

// provider=odsay 일 때 경로 서버가 알려 주는 실패
const ODSAY_ERROR_TEXT = Object.freeze({
  503: '경로 서버에 ODsay 키가 없습니다',
  429: '오늘 쓸 수 있는 횟수를 다 썼습니다',
})

/**
 * 그 제공자로만 한 번 찾아 본다 (설정 탭의 '연결 확인'. 하루 한도에서 1회를 쓴다). 실패해도 throw 하지 않는다.
 * @param {'kakao'|'odsay'} provider
 * @returns {Promise<string>} 화면에 보일 결과 문장
 */
export async function testProvider(provider, { fetchRoute = routeFetch } = {}) {
  const query = new URLSearchParams({
    start_latitude: TEST_TRIP.start.y,
    start_longitude: TEST_TRIP.start.x,
    end_latitude: TEST_TRIP.end.y,
    end_longitude: TEST_TRIP.end.x,
    provider,
  })
  try {
    const { status, body } = await fetchRoute(`/routes/transit?${query}`, { timeoutMs: 12000 })
    if (status === 200 && Array.isArray(body)) return `연결됨: ${TEST_TRIP.from} → ${TEST_TRIP.to} 경로 ${body.length}개를 받았습니다`
    if (provider === 'odsay' && ODSAY_ERROR_TEXT[status]) return `실패: ${ODSAY_ERROR_TEXT[status]}`
    const detail = typeof body?.detail === 'string' ? body.detail : `HTTP ${status}`
    return `실패: ${PROVIDERS[provider].subject} 경로를 주지 않았습니다 (${detail})`
  } catch {
    return '실패: 경로 서버에 닿지 못했습니다'
  }
}
