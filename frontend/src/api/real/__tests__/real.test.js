// real API 계층 테스트. 서버 응답(성공·실패 모양)을 화면이 쓰는 모양으로 바르게 바꾸는지 확인한다.
// fetch 를 가짜로 바꿔 끼우므로 서버 없이 돈다.
// 환경: node (document 불필요. FormData·Blob 은 Node 가 제공한다)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { health } from '../health.js'
import { stt } from '../stt.js'
import { resolve, clearResolveContext } from '../resolve.js'
import { getPois } from '../pois.js'
import { route } from '../route.js'
import { createQr } from '../qr.js'
import { getLocation, clearOrigin } from '../location.js'
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
      mockFetch(fail('INTERNAL_ERROR', '잠시 문제가 생겼어요. 처음 화면으로 돌아갈게요.'), 500)
      await expect(resolve('서울역')).rejects.toMatchObject({ code: 'UNKNOWN' })
    })
  })

  describe('route / createQr', () => {
    // 경로 서버(server/app.py) GET /routes/transit 의 응답: 성공이면 경로 배열, 실패면 HTTP 상태 코드와 { detail }
    const step = (type, extra = {}) => ({ type, guidance: '', duration_seconds: 600, distance_meters: 3000, stop_names: [], vehicle_names: [], ...extra })
    const SUBWAY_ROUTE = {
      summary: '전철만 이용해요. 약 31분 걸려요. 1번 갈아타요.',
      instructions: [
        '종로3가역까지 약 40미터 걸으세요.',
        '종로3가역에서 수도권 3호선 열차를 타세요. 교대역에서 내리세요.',
        '교대역에서 수도권 2호선 열차를 타세요. 선릉역에서 내리세요.',
      ],
      type: 'SUBWAY',
      duration_seconds: 1850,
      distance_meters: 9800,
      transfers: 1,
      steps: [
        step('WALKING', { duration_seconds: 50, distance_meters: 40, stop_names: ['종로3가역'] }),
        step('SUBWAY', { stop_names: ['종로3가', '을지로3가', '교대'], vehicle_names: ['수도권 3호선'] }),
        step('SUBWAY', { stop_names: ['교대', '강남', '역삼', '선릉'], vehicle_names: ['수도권 2호선'] }),
      ],
    }
    const BUS_ROUTE = {
      summary: '버스만 이용해요. 약 40분 걸려요. 갈아타지 않아요.',
      instructions: ['종로3가 정류장에서 8641(평일), 273번 버스 중 한 대를 타세요. 선릉역 정류장에서 내리세요.'],
      type: 'BUS',
      duration_seconds: 2400,
      distance_meters: 10200,
      transfers: 0,
      steps: [step('BUS', { duration_seconds: 2400, stop_names: ['종로3가', '선릉역'], vehicle_names: ['8641(평일)', '273'] })],
    }
    const KIOSK = { source: 'KIOSK', name: '종로3가역 키오스크', x: 126.9918, y: 37.5704, snapped: false, easy_text: '지금 계신 곳: 종로3가역 키오스크' }

    /** 화면이 거치는 순서대로 준비한다: 목적지 후보를 받고(toPoi), 첫 화면에서 현재 위치를 받는다(getLocation) */
    async function prepare(origin = KIOSK) {
      toPoi(SUBWAY)
      vi.stubGlobal('navigator', {})
      mockFetch(ok(origin))
      await getLocation()
    }

    beforeEach(() => {
      vi.spyOn(console, 'info').mockImplementation(() => {})
      clearOrigin()
    })

    it('출발·도착 좌표로 경로 서버를 부르고 화면 모양으로 바꾼다', async () => {
      await prepare()
      const fetchFn = mockFetch([SUBWAY_ROUTE])
      const result = await route('SUB_0220_2호선')
      expect(fetchFn.mock.calls[0][0]).toBe('/routes/transit?start_latitude=37.5704&start_longitude=126.9918&end_latitude=37.504&end_longitude=127.048')
      expect(result.routes).toHaveLength(1)
      // 디자인 문서 9-2절 모양만. 노선 ID·출구는 서버가 주지 않아 비운다
      expect(result).toEqual({
        routes: [
          {
            id: 'SUB_0220_2호선#1',
            durationMin: 31,
            exit: null,
            start: null,
            legs: [
              { mode: 'WALK', minutes: 1, to: { name: '종로3가역', kind: 'STATION' } },
              { mode: 'SUBWAY', lineId: null, label: '3', stops: 2, to: { name: '교대역', kind: 'STATION' } },
              { mode: 'SUBWAY', lineId: null, label: '2', stops: 3, to: { name: '선릉역', kind: 'STATION' } },
            ],
          },
        ],
      })
    })
    it('버스는 늘 다니는 번호를 고르고, 경로가 많아도 서버가 준 순서대로 앞의 3개만 쓴다', async () => {
      await prepare()
      mockFetch([BUS_ROUTE, SUBWAY_ROUTE, BUS_ROUTE, SUBWAY_ROUTE, BUS_ROUTE])
      const { routes } = await route('SUB_0220_2호선')
      expect(routes.map((r) => [r.id, r.durationMin, r.legs[0].mode, r.legs[0].number ?? r.legs[0].label])).toEqual([
        ['SUB_0220_2호선#1', 40, 'BUS', '273'],
        ['SUB_0220_2호선#2', 31, 'WALK', undefined],
        ['SUB_0220_2호선#3', 40, 'BUS', '273'],
      ])
    })
    it('경로 조회 뒤에는 같은 출발·도착지의 카카오맵 주소를 휴대폰으로 보낼 수 있다', async () => {
      await prepare()
      mockFetch([SUBWAY_ROUTE])
      await route('SUB_0220_2호선')
      expect(await createQr('SUB_0220_2호선#1')).toEqual({
        url: `https://map.kakao.com/link/by/traffic/${encodeURIComponent('종로3가역 키오스크')},37.5704,126.9918/${encodeURIComponent('선릉역')},37.504,127.048`,
      })
    })
    it('경로가 없으면 빈 목록, 그 뒤 createQr 는 QR_ERROR', async () => {
      await prepare()
      mockFetch([])
      expect(await route('SUB_0220_2호선')).toEqual({ routes: [] })
      await expect(createQr('SUB_0220_2호선#1')).rejects.toThrow('QR_ERROR')
    })
    it('아주 가까운 곳은 서버를 부르지 않고 걸어가라고 안내한다', async () => {
      await prepare({ ...KIOSK, name: '선릉역 근처', x: 127.048, y: 37.5067 }) // 선릉역에서 북쪽으로 약 300미터
      const fetchFn = mockFetch([SUBWAY_ROUTE])
      await expect(route('SUB_0220_2호선')).rejects.toMatchObject({ code: 'TOO_CLOSE', message: '가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.' })
      expect(fetchFn).not.toHaveBeenCalled()
    })
    it('경로 서버가 실패하면(카카오맵 오류·키 미설정 등) UPSTREAM 으로 throw 한다', async () => {
      await prepare()
      // 서버 내부 오류(500)의 본문은 JSON 이 아니다
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          status: 500,
          json: async () => {
            throw new SyntaxError('Unexpected token I')
          },
        })),
      )
      await expect(route('SUB_0220_2호선')).rejects.toMatchObject({ code: 'UPSTREAM' })
    })
    it('좌표가 잘못됐다는 응답(422 + detail)도 UNKNOWN', async () => {
      await prepare()
      mockFetch({ detail: [{ loc: ['query', 'end_latitude'], msg: 'Input should be less than or equal to 90' }] }, 422)
      await expect(route('SUB_0220_2호선')).rejects.toMatchObject({ code: 'UNKNOWN' })
    })
    it('후보로 받은 적 없는 목적지는 서버를 부르지 않고 UNKNOWN', async () => {
      await prepare()
      const fetchFn = mockFetch([SUBWAY_ROUTE])
      await expect(route('NEVER_SEEN')).rejects.toMatchObject({ code: 'UNKNOWN' })
      expect(fetchFn).not.toHaveBeenCalled()
    })
    it('현재 위치를 아직 모르면 먼저 위치를 물은 뒤 경로를 조회한다', async () => {
      toPoi(SUBWAY)
      vi.stubGlobal('navigator', {})
      const fetchFn = vi
        .fn()
        .mockResolvedValueOnce({ status: 200, json: async () => ok(KIOSK) })
        .mockResolvedValueOnce({ status: 200, json: async () => [SUBWAY_ROUTE] })
      vi.stubGlobal('fetch', fetchFn)
      const result = await route('SUB_0220_2호선')
      expect(fetchFn.mock.calls.map((c) => c[0])).toEqual(['/api/v1/location', expect.stringContaining('/routes/transit?start_latitude=37.5704')])
      expect(result.routes).toHaveLength(1)
    })
    it('현재 위치를 끝내 알 수 없으면 UNKNOWN', async () => {
      toPoi(SUBWAY)
      vi.stubGlobal('navigator', {})
      mockFetch(fail('KIOSK_NOT_FOUND', '기기 설정에 문제가 있어요.'), 404)
      await expect(route('SUB_0220_2호선')).rejects.toMatchObject({ code: 'UNKNOWN' })
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
      place: null, // 서버가 장소 정보를 주기 전에는 null → 띠는 "정보 없음" (team-requests.md #1)
    })
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('/api/v1/location') // 좌표는 주소에 싣지 않는다
    expect(init.method).toBe('POST')
    expect(sentBody(fetchFn)).toEqual({ kiosk_id: 'KIOSK_JONGNO_01', x: 127.0383, y: 37.5786, accuracy: 18 })
  })

  it('서버가 장소 정보(place)를 주면 그대로 싣는다', async () => {
    stubGeolocation((onOk) => onOk(HERE))
    const place = { type: 'BUS_STOP', name: '경동시장앞 정류장', buses: [{ kind: 'TRUNK', numbers: ['120'] }] }
    mockFetch(ok({ source: 'GPS', name: '경동시장앞 정류장', snapped: true, accuracy_m: 18, place }))
    expect((await getLocation()).place).toEqual(place)
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

describe('real API: resolve 되묻기 (ask · context)', () => {
  const sentBody = (fetchFn, i = 0) => JSON.parse(fetchFn.mock.calls[i][1].body)
  const JONGNO3 = { poi_id: 'SUB_0130_1호선', name: '종로3가', display_name: '종로3가역 (1호선)', poi_type: 'SUBWAY_STATION', x: 126.99, y: 37.57, score: 1 }
  const JONGNO5 = { poi_id: 'SUB_0129_1호선', name: '종로5가', display_name: '종로5가역 (1호선)', poi_type: 'SUBWAY_STATION', x: 127.0, y: 37.57, score: 1 }
  const ASK = { type: 'NUMBER', stem: '종로', unit: '가', numbers: [1, 2, 3, 4, 5, 6], text: '종로 몇 가로 가세요? 1가부터 6가까지 있어요.' }

  beforeEach(() => clearResolveContext())
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('서버가 되물으면 질문 문장과 선택지를 그대로 전달한다', async () => {
    mockFetch(ok({ intent: 'NAVIGATE', need_confirm: true, confirm_text: ASK.text, ask: ASK, destination_candidates: [JONGNO3, JONGNO5] }))
    const r = await resolve('종로 가려는데요')
    expect(r).toMatchObject({ status: 'OK', needConfirm: true, confirmText: ASK.text, ask: ASK })
    expect(r.candidates.map((c) => c.name)).toEqual(['종로3가역', '종로5가역'])
  })

  it("'몇 가' 질문 뒤의 다음 말에는 context 를 붙여 보내고, 한 번 쓰면 지운다", async () => {
    mockFetch(ok({ intent: 'NAVIGATE', need_confirm: true, confirm_text: ASK.text, ask: ASK, destination_candidates: [JONGNO3, JONGNO5] }))
    await resolve('종로 가려는데요')

    const second = mockFetch(ok({ intent: 'NAVIGATE', need_confirm: false, confirm_text: null, destination_candidates: [JONGNO3] }))
    const r = await resolve('삼가요')
    expect(sentBody(second).context).toEqual(ASK)
    expect(r).toMatchObject({ status: 'OK', needConfirm: false })

    const third = mockFetch(ok({ intent: 'NAVIGATE', need_confirm: false, confirm_text: null, destination_candidates: [JONGNO5] }))
    await resolve('종로5가 가려는데요')
    expect(sentBody(third).context).toBeUndefined()
  })

  it('고르기 질문(CHOICE)은 이어 보낼 context 를 남기지 않는다', async () => {
    const choice = { type: 'CHOICE', text: '종로3가역과 종로5가역 중 어디로 가세요?' }
    mockFetch(ok({ intent: 'NAVIGATE', need_confirm: true, confirm_text: choice.text, ask: choice, destination_candidates: [JONGNO3, JONGNO5] }))
    await resolve('종로')
    const next = mockFetch(ok({ intent: 'NAVIGATE', need_confirm: false, confirm_text: null, destination_candidates: [JONGNO3] }))
    await resolve('종로3가')
    expect(sentBody(next).context).toBeUndefined()
  })
})
