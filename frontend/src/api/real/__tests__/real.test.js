// real API 계층 테스트. 서버 응답(성공·실패 모양)을 화면이 쓰는 모양으로 바르게 바꾸는지 확인한다.
// fetch 를 가짜로 바꿔 끼우므로 서버 없이 돈다.
// 환경: node (document 불필요. FormData·Blob 은 Node 가 제공한다)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { health } from '../health.js'
import { stt } from '../stt.js'
import { resolve } from '../resolve.js'
import { getPois } from '../pois.js'
import { route } from '../route.js'
import { createQr } from '../qr.js'
import { getLocation } from '../location.js'
import { toPoi } from '../poi.js'

const ok = (data) => ({ success: true, data, latency_ms: 1 })
const fail = (code, easy_message) => ({ success: false, error: { code, message: code, easy_message }, latency_ms: 1 })

/** 다음 fetch 호출이 주어진 본문을 돌려주게 한다 */
function mockFetch(body, status = 200) {
  const fn = vi.fn(async () => ({ status, json: async () => body }))
  vi.stubGlobal('fetch', fn)
  return fn
}

const SUBWAY = {
  poi_id: 'SUB_0220_2호선',
  name: '선릉',
  display_name: '선릉역 (2호선)',
  poi_type: 'SUBWAY_STATION',
  x: 127.048,
  y: 37.504,
  distance_m: 8876,
  score: 0.95,
}
const BUS = {
  poi_id: 'BUS_105000101',
  name: '경동시장앞',
  display_name: '경동시장앞 정류장',
  poi_type: 'BUS_STOP',
  x: 127.038,
  y: 37.578,
  distance_m: 4281,
  score: 0.9,
}

describe('real API', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('toPoi', () => {
    it('지하철역은 노선을 category 로 옮기고 이름에서 괄호를 뺀다', () => {
      expect(toPoi(SUBWAY)).toMatchObject({ id: 'SUB_0220_2호선', name: '선릉역', category: '지하철 2호선' })
    })
    it('버스정류장은 정식 이름과 버스정류장 category 를 쓴다', () => {
      expect(toPoi(BUS)).toMatchObject({ id: 'BUS_105000101', name: '경동시장앞', category: '버스정류장' })
    })
  })

  describe('health', () => {
    it('모델과 지식베이스가 모두 준비되면 { server: true, stt: true }', async () => {
      const fetchFn = mockFetch(ok({ status: 'ok', stt: { loaded: true }, knowledge_base: { loaded: true } }))
      expect(await health()).toEqual({ server: true, stt: true })
      expect(fetchFn.mock.calls[0][0]).toBe('/api/v1/health')
    })
    it('모델이 아직 안 올라왔으면 stt 는 false', async () => {
      mockFetch(ok({ status: 'degraded', stt: { loaded: false }, knowledge_base: { loaded: true } }))
      expect(await health()).toEqual({ server: true, stt: false })
    })
    it('서버에 닿지 못하면 throw 한다 (핸들러가 서버 불가로 처리)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new TypeError('Failed to fetch')
        }),
      )
      await expect(health()).rejects.toThrow('SERVER_UNREACHABLE')
    })
  })

  describe('stt', () => {
    it('녹음이 없으면 서버를 부르지 않고 빈 텍스트를 돌려준다 (무발화)', async () => {
      const fetchFn = mockFetch(ok({}))
      expect(await stt({ text: '' })).toEqual({ text: '' })
      expect(fetchFn).not.toHaveBeenCalled()
    })
    it('녹음을 multipart 로 보내고 보정된 문장을 text 로 돌려준다', async () => {
      const fetchFn = mockFetch(ok({ raw_text: '선능력 가려면', corrected_text: '선릉역 가려면', confidence: 0.9, rag_applied: true }))
      const audio = new Blob(['fake'], { type: 'audio/webm;codecs=opus' })
      const result = await stt({ audio })
      expect(result).toMatchObject({ text: '선릉역 가려면', rawText: '선능력 가려면', ragApplied: true })
      const [url, init] = fetchFn.mock.calls[0]
      expect(url).toBe('/api/v1/stt')
      expect(init.method).toBe('POST')
      expect(init.body.get('kiosk_id')).toBe('KIOSK_JONGNO_01')
      expect(init.body.get('audio').name).toBe('speech.webm')
    })
    it('EMPTY_AUDIO 는 오류가 아니라 빈 텍스트다', async () => {
      mockFetch(fail('EMPTY_AUDIO', '소리가 잘 들리지 않았어요.'), 400)
      expect(await stt({ audio: new Blob(['x'], { type: 'audio/webm' }) })).toEqual({ text: '' })
    })
    it('그 밖의 실패는 서버의 쉬운 문장으로 throw 한다', async () => {
      mockFetch(fail('MODEL_NOT_READY', '준비 중이에요. 잠시 후 다시 말씀해 주세요.'), 503)
      await expect(stt({ audio: new Blob(['x'], { type: 'audio/webm' }) })).rejects.toThrow('준비 중이에요')
    })
  })

  describe('resolve', () => {
    it('빈 문장은 서버를 부르지 않고 NOT_UNDERSTOOD', async () => {
      const fetchFn = mockFetch(ok({}))
      expect(await resolve('  ')).toEqual({ status: 'NOT_UNDERSTOOD' })
      expect(fetchFn).not.toHaveBeenCalled()
    })
    it('확인이 필요 없으면 1순위를 poi 로 돌려준다', async () => {
      const fetchFn = mockFetch(ok({ intent: 'NAVIGATE', need_confirm: false, confirm_text: '선릉역으로 가시는 게 맞으세요?', destination_candidates: [SUBWAY, BUS] }))
      const result = await resolve('선릉역 가려면 어떻게 가')
      expect(result.status).toBe('OK')
      expect(result.needConfirm).toBe(false)
      expect(result.poi).toMatchObject({ id: 'SUB_0220_2호선', name: '선릉역' })
      expect(result.transcript).toBe('선릉역 가려면 어떻게 가')
      const [url, init] = fetchFn.mock.calls[0]
      expect(url).toBe('/api/v1/resolve')
      expect(JSON.parse(init.body)).toEqual({ text: '선릉역 가려면 어떻게 가', kiosk_id: 'KIOSK_JONGNO_01', input_mode: 'VOICE' })
    })
    it('확인이 필요하면 후보 목록을 돌려준다', async () => {
      mockFetch(ok({ intent: 'NAVIGATE', need_confirm: true, confirm_text: '…', destination_candidates: [SUBWAY, BUS] }))
      const result = await resolve('선능력')
      expect(result).toMatchObject({ status: 'OK', needConfirm: true })
      expect(result.candidates.map((c) => c.id)).toEqual(['SUB_0220_2호선', 'BUS_105000101'])
      expect(result.poi).toBeUndefined()
    })
    it('NO_CANDIDATE 는 NOT_UNDERSTOOD, OUT_OF_SCOPE 는 OUT_OF_SCOPE', async () => {
      mockFetch(fail('NO_CANDIDATE', '어디로 가실지 잘 못 알아들었어요.'))
      expect((await resolve('어디 가지')).status).toBe('NOT_UNDERSTOOD')
      mockFetch(fail('OUT_OF_SCOPE', '이 키오스크에서는 서울 안의 길만 안내할 수 있어요.'))
      expect((await resolve('수원역 가려면')).status).toBe('OUT_OF_SCOPE')
    })
    it('길찾기가 아닌 말(네, 그만 등)은 NOT_UNDERSTOOD 로 보고 intent 를 실어 둔다', async () => {
      mockFetch(ok({ intent: 'AFFIRM', need_confirm: false, confirm_text: null, destination_candidates: [] }))
      expect(await resolve('네 맞아요')).toMatchObject({ status: 'NOT_UNDERSTOOD', intent: 'AFFIRM' })
    })
    it('그 밖의 실패는 throw 한다', async () => {
      mockFetch(fail('INTERNAL_ERROR', '잠시 문제가 생겼어요. 처음 화면으로 돌아갈게요.'), 500)
      await expect(resolve('서울역')).rejects.toThrow('잠시 문제가 생겼어요')
    })
  })

  describe('route / createQr', () => {
    const ROUTE_DATA = {
      summary_text: '선릉역까지 가는 길을 1가지 찾았어요.',
      destination: { poi_id: 'SUB_0220_2호선', name: '선릉역', x: 127.048, y: 37.504 },
      landing_url: 'https://map.kakao.com/link/by/traffic/a,37.57,126.99/b,37.50,127.04',
      routes: [
        {
          rank: 1,
          path_type: 'SUBWAY',
          total_min: 31,
          transfers: 1,
          walk_m: 130,
          fare: 1400,
          headline: '31분 · 1번 갈아타요 · 130미터 걸어요',
          summary: '지하철 3호선 → 지하철 2호선',
          steps: [{ order: 1, mode: 'WALK', minutes: 1, distance_m: 40, easy_text: '종로3가역까지 40미터 걸어가세요.' }],
        },
      ],
    }

    it('서버 경로를 화면 모양으로 바꾸고 kiosk_id·dest_poi_id 로 조회한다', async () => {
      const fetchFn = mockFetch(ok(ROUTE_DATA))
      const result = await route('SUB_0220_2호선')
      expect(fetchFn.mock.calls[0][0]).toBe(`/api/v1/route?kiosk_id=KIOSK_JONGNO_01&dest_poi_id=${encodeURIComponent('SUB_0220_2호선')}`)
      expect(result.routes).toHaveLength(1)
      expect(result.routes[0]).toMatchObject({
        id: 'SUB_0220_2호선#1',
        rank: 1,
        summary: '지하철 3호선 → 지하철 2호선',
        durationMin: 31,
        transfers: 1,
        walkM: 130,
      })
      expect(result.routes[0].steps[0]).toMatchObject({ mode: 'WALK', distanceM: 40, easyText: '종로3가역까지 40미터 걸어가세요.' })
    })
    it('경로 조회 뒤에는 휴대폰으로 보낼 카카오맵 주소를 돌려준다', async () => {
      mockFetch(ok(ROUTE_DATA))
      await route('SUB_0220_2호선')
      expect(await createQr('SUB_0220_2호선#1')).toEqual({ url: ROUTE_DATA.landing_url })
    })
    it('ROUTE_NOT_FOUND 는 빈 목록, 그 뒤 createQr 는 QR_ERROR', async () => {
      mockFetch(fail('ROUTE_NOT_FOUND', '가는 길을 찾지 못했어요.'), 404)
      expect(await route('BUS_1')).toEqual({ routes: [] })
      await expect(createQr('BUS_1#1')).rejects.toThrow('QR_ERROR')
    })
    it('너무 가까우면 서버의 쉬운 문장으로 throw 한다', async () => {
      mockFetch(fail('ROUTE_TOO_CLOSE', '가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.'), 422)
      await expect(route('SUB_0130_1호선')).rejects.toThrow('약 300미터예요')
    })
    it('지도 서버 오류도 쉬운 문장으로 throw 한다', async () => {
      mockFetch(fail('UPSTREAM_ERROR', '지금은 길 안내를 받아올 수 없어요. 잠시 후 다시 해 주세요.'), 502)
      await expect(route('SUB_0220_2호선')).rejects.toThrow('지금은 길 안내를 받아올 수 없어요')
    })
  })

  describe('getPois', () => {
    it('서버 목록을 Poi 배열로 바꾼다', async () => {
      const fetchFn = mockFetch(ok({ pois: [SUBWAY] }))
      expect(await getPois()).toEqual([expect.objectContaining({ id: 'SUB_0220_2호선', name: '선릉역', category: '지하철 2호선' })])
      expect(fetchFn.mock.calls[0][0]).toBe('/api/v1/pois?kiosk_id=KIOSK_JONGNO_01')
    })
    it('실패하면 throw 한다 (화면이 오류 문구만 표시)', async () => {
      mockFetch(fail('KIOSK_NOT_FOUND', '기기 설정에 문제가 있어요.'), 404)
      await expect(getPois()).rejects.toThrow('기기 설정에 문제가 있어요')
    })
  })
})

describe('real API: getLocation (현재 위치)', () => {
  const HERE = { coords: { longitude: 127.0383, latitude: 37.5786, accuracy: 18 } }
  const stubGeolocation = (impl) => vi.stubGlobal('navigator', impl ? { geolocation: { getCurrentPosition: impl } } : {})
  const sentBody = (fetchFn) => JSON.parse(fetchFn.mock.calls[0][1].body)

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('브라우저 위치를 본문으로 알리고, 서버가 맞춘 정류장 이름을 돌려준다', async () => {
    stubGeolocation((onOk) => onOk(HERE))
    const fetchFn = mockFetch(
      ok({ source: 'GPS', name: '경동시장앞 정류장', snapped: true, accuracy_m: 18, fallback_reason: null, easy_text: '지금 계신 곳: 경동시장앞 정류장' }),
    )

    expect(await getLocation()).toEqual({
      name: '경동시장앞 정류장',
      text: '지금 계신 곳: 경동시장앞 정류장',
      source: 'GPS',
      snapped: true,
      accuracyM: 18,
      reason: null,
    })
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/v1/location') // 좌표는 주소에 싣지 않는다
    expect(init.method).toBe('POST')
    expect(sentBody(fetchFn)).toEqual({ kiosk_id: 'KIOSK_JONGNO_01', x: 127.0383, y: 37.5786, accuracy: 18 })
  })

  it('위치 사용을 거절하면 좌표 없이 알리고, 고정 위치와 그 이유를 돌려준다', async () => {
    stubGeolocation((_onOk, onError) => onError({ code: 1 }))
    const fetchFn = mockFetch(
      ok({ source: 'KIOSK', name: '종로3가역 키오스크', snapped: false, accuracy_m: null, fallback_reason: 'NO_POSITION', easy_text: '지금 계신 곳: 종로3가역 키오스크' }),
    )

    expect(await getLocation()).toMatchObject({ name: '종로3가역 키오스크', source: 'KIOSK', reason: 'PERMISSION_DENIED' })
    expect(sentBody(fetchFn)).toEqual({ kiosk_id: 'KIOSK_JONGNO_01' })
  })

  it('위치 기능이 없는 브라우저(보안 연결이 아닌 경우 포함)에서도 고정 위치로 동작한다', async () => {
    stubGeolocation(null)
    const fetchFn = mockFetch(ok({ source: 'KIOSK', name: '종로3가역 키오스크', fallback_reason: 'NO_POSITION', easy_text: '지금 계신 곳: 종로3가역 키오스크' }))

    expect(await getLocation()).toMatchObject({ source: 'KIOSK', reason: 'NO_GEOLOCATION', text: '지금 계신 곳: 종로3가역 키오스크' })
    expect(sentBody(fetchFn)).toEqual({ kiosk_id: 'KIOSK_JONGNO_01' })
  })

  it('서버가 받은 위치를 쓸 수 없다고 하면(오차가 큼·범위 밖) 그 이유를 싣는다', async () => {
    stubGeolocation((onOk) => onOk({ coords: { longitude: 127.0383, latitude: 37.5786, accuracy: 5000 } }))
    mockFetch(ok({ source: 'KIOSK', name: '종로3가역 키오스크', fallback_reason: 'LOW_ACCURACY', easy_text: '지금 계신 곳: 종로3가역 키오스크' }))

    expect(await getLocation()).toMatchObject({ source: 'KIOSK', reason: 'LOW_ACCURACY' })
  })

  it('서버 호출이 실패하면 서버의 쉬운 문장으로 Error 를 던진다', async () => {
    stubGeolocation((onOk) => onOk(HERE))
    mockFetch(fail('KIOSK_NOT_FOUND', '기기 설정에 문제가 있어요. 직원에게 알려 주세요.'), 404)

    await expect(getLocation()).rejects.toThrow('기기 설정에 문제가 있어요')
  })
})
