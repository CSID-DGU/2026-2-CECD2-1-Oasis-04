// 경로 찾기 설정 (2026-11-22): 저장과 읽기, 서버에 넘길 provider 값, 제공자 상태와 남은 횟수, 연결 확인.
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  BACKUP_MODES,
  ROUTE_BACKUP_KEY,
  leftOf,
  probeRoutes,
  providerOf,
  providerOff,
  providerStatusText,
  readRouteBackup,
  testProvider,
  writeRouteBackup,
} from '../routeBackup.js'

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data }
}

const mockFetch = (body, status = 200) => {
  const fn = vi.fn(async () => ({ status, json: async () => body }))
  vi.stubGlobal('fetch', fn)
  return fn
}

const usage = (configured, usedToday, dailyLimit) => ({ configured, usedToday, dailyLimit })
const READY = { reachable: true, kakao: usage(true, 12, 1000), odsay: usage(true, 3, 30) }

describe('경로 찾기 설정', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('처음 값은 "카카오 먼저, 실패하면 ODsay" 이고, 보이는 순서는 카카오 먼저 → ODsay 로만 → 백업 쓰지 않기', () => {
    expect(BACKUP_MODES).toEqual(['auto', 'only', 'off'])
    expect(readRouteBackup(fakeStorage())).toBe('auto')
    expect(readRouteBackup(fakeStorage({ [ROUTE_BACKUP_KEY]: '이상한값' }))).toBe('auto')
    expect(readRouteBackup(null)).toBe('auto')
  })

  it('저장한 값을 다시 읽고, 처음 값으로 되돌리면 지운다', () => {
    const storage = fakeStorage()
    expect(writeRouteBackup('off', storage)).toBe(true)
    expect(readRouteBackup(storage)).toBe('off')
    expect(writeRouteBackup('only', storage)).toBe(true)
    expect(readRouteBackup(storage)).toBe('only')
    expect(writeRouteBackup('auto', storage)).toBe(true)
    expect(storage.data.has(ROUTE_BACKUP_KEY)).toBe(false)
  })

  it('모르는 값이나 저장소가 없으면 저장하지 못한다', () => {
    expect(writeRouteBackup('always', fakeStorage())).toBe(false)
    expect(writeRouteBackup('off', null)).toBe(false)
  })

  it('경로 서버에 넘길 provider: 처음 값은 넘기지 않고, 끄면 kakao, ODsay 로만이면 odsay', () => {
    expect(['auto', 'off', 'only', '이상한값'].map(providerOf)).toEqual([null, 'kakao', 'odsay', null])
  })

  it('남은 횟수 = 하루 한도 - 오늘 쓴 횟수. 모르면 null', () => {
    expect(leftOf(usage(true, 3, 30))).toBe(27)
    expect(leftOf(usage(true, 31, 30))).toBe(0)
    expect(leftOf(usage(true, null, null))).toBeNull()
    expect(leftOf(null)).toBeNull()
  })

  it('제공자 상태 문장에 쓴 횟수와 남은 횟수가 들어간다', () => {
    expect(providerStatusText('kakao', null)).toBe('서버를 확인하는 중입니다')
    expect(providerStatusText('kakao', READY)).toBe('키 있음 · 오늘 12회 사용 · 남은 횟수 988회 (하루 1,000회)')
    expect(providerStatusText('odsay', READY)).toBe('키 있음 · 오늘 3회 사용 · 남은 횟수 27회 (하루 30회)')
    expect(providerStatusText('odsay', { reachable: true, kakao: usage(true, 0, 1000), odsay: usage(false, 0, 30) })).toBe(
      '키가 없습니다. 경로 서버를 띄울 때 환경변수 ODSAY_API_KEY 를 넘겨 주세요',
    )
    expect(providerStatusText('kakao', { reachable: true, kakao: usage(false, 0, 1000), odsay: null })).toContain('KAKAO_REST_API_KEY')
    expect(providerStatusText('kakao', { reachable: false, kakao: null, odsay: null })).toBe('경로 서버가 응답하지 않습니다')
    expect(providerStatusText('odsay', { reachable: true, kakao: null, odsay: null })).toBe('이 경로 서버는 상태를 알려 주지 않습니다')
    expect(providerStatusText('kakao', { reachable: true, kakao: usage(true, null, null), odsay: null })).toBe('키 있음')
  })

  it('쓸 수 없는 제공자를 가린다', () => {
    expect([providerOff('kakao', READY), providerOff('odsay', READY), providerOff('kakao', null)]).toEqual([false, false, false])
    expect(providerOff('odsay', { reachable: true, kakao: usage(true, 0, 1000), odsay: usage(false, 0, 30) })).toBe(true)
    expect(providerOff('kakao', { reachable: false, kakao: null, odsay: null })).toBe(true)
  })

  it('probeRoutes: 경로 서버의 /routes/status 에서 두 제공자의 키 유무와 쓴 횟수를 읽는다', async () => {
    const fetchFn = mockFetch({
      kakao: { configured: true, used_today: 12, daily_limit: 1000 },
      odsay: { configured: false, used_today: 0, daily_limit: 30 },
    })
    expect(await probeRoutes()).toEqual({ reachable: true, kakao: usage(true, 12, 1000), odsay: usage(false, 0, 30) })
    expect(fetchFn.mock.calls[0][0]).toBe('/routes/status')
  })

  it('probeRoutes: 상태 주소가 없는 예전 경로 서버(404)나 꺼진 서버도 던지지 않는다', async () => {
    mockFetch({ detail: 'Not Found' }, 404)
    expect(await probeRoutes()).toEqual({ reachable: true, kakao: null, odsay: null })
    mockFetch(null, 502) // 개발 서버의 proxy 가 경로 서버에 닿지 못했을 때
    expect(await probeRoutes()).toEqual({ reachable: false, kakao: null, odsay: null })
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('failed'))))
    expect(await probeRoutes()).toEqual({ reachable: false, kakao: null, odsay: null })
  })

  it('연결 확인: 그 제공자로만 한 번 찾고 결과를 한 문장으로', async () => {
    const seen = []
    const answer = (status, body) => async (path) => {
      seen.push(path)
      return { status, body }
    }
    expect(await testProvider('kakao', { fetchRoute: answer(200, new Array(15).fill({})) })).toBe('연결됨: 종로3가역 → 서울역 경로 15개를 받았습니다')
    expect(seen[0]).toBe('/routes/transit?start_latitude=37.5704&start_longitude=126.9918&end_latitude=37.5547&end_longitude=126.9707&provider=kakao')
    expect(await testProvider('odsay', { fetchRoute: answer(200, [{}, {}]) })).toBe('연결됨: 종로3가역 → 서울역 경로 2개를 받았습니다')
    expect(seen[1]).toMatch(/&provider=odsay$/)
  })

  it('연결 확인: 실패한 이유를 알린다', async () => {
    const answer = (status, body) => async () => ({ status, body })
    expect(await testProvider('kakao', { fetchRoute: answer(500, null) })).toBe('실패: 카카오맵이 경로를 주지 않았습니다 (HTTP 500)')
    expect(await testProvider('odsay', { fetchRoute: answer(503, { detail: 'BACKUP_NOT_CONFIGURED: ODSAY_API_KEY is not set' }) })).toBe(
      '실패: 경로 서버에 ODsay 키가 없습니다',
    )
    expect(await testProvider('odsay', { fetchRoute: answer(429, { detail: 'BACKUP_LIMIT: daily limit 30 reached' }) })).toBe('실패: 오늘 쓸 수 있는 횟수를 다 썼습니다')
    expect(await testProvider('odsay', { fetchRoute: answer(502, { detail: 'BACKUP_UPSTREAM: ODsay 500: [ApiKeyAuthFailed]' }) })).toBe(
      '실패: ODsay 가 경로를 주지 않았습니다 (BACKUP_UPSTREAM: ODsay 500: [ApiKeyAuthFailed])',
    )
    expect(
      await testProvider('kakao', {
        fetchRoute: async () => {
          throw new Error('SERVER_UNREACHABLE')
        },
      }),
    ).toBe('실패: 경로 서버에 닿지 못했습니다')
  })
})
