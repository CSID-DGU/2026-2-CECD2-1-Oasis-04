// 경로 백업 (2026-11-22): 카카오맵이 실패하면 경로 서버가 ODsay 로 대신 찾아 같은 모양으로 준다 (server/odsay_transit.py).
// 화면은 설정에서 고른 방식만 provider 값으로 넘기고, ODsay 에서 온 경로도 같은 코드로 화면 모양으로 바꾼다.
// 환경: node. fetch 를 가짜로 바꿔 끼운다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { route } from '../route.js'
import { getLocation, clearOrigin } from '../location.js'
import { toPoi } from '../poi.js'
import { toRouteGuide } from '../../../view/routeView.js'

const at = (h, m = 0) => new Date(Date.UTC(2026, 10, 23, h - 9, m)) // 월요일
const ok = (data) => ({ success: true, data, latency_ms: 1 })

const DEST = { poi_id: 'SUB_0332_3호선', name: '동대입구', display_name: '동대입구역 (3호선)', poi_type: 'SUBWAY_STATION', x: 127.005273, y: 37.55906, distance_m: 2000, score: 0.95 }
const KIOSK = { source: 'KIOSK', name: '종로3가역 키오스크', x: 126.9918, y: 37.5704, snapped: false, easy_text: '지금 계신 곳: 종로3가역 키오스크' }

const step = (type, extra = {}) => ({ type, guidance: '', duration_seconds: 600, distance_meters: 3000, stop_names: [], vehicle_names: [], ...extra })
// 경로 서버가 ODsay 에서 받아 준 경로의 모양: 카카오맵과 같은 배열이고, 처음과 끝의 걷는 구간이 들어 있다
const ODSAY_SUBWAY = {
  type: 'SUBWAY',
  duration_seconds: 900,
  distance_meters: 6400,
  transfers: 0,
  steps: [
    step('WALKING', { duration_seconds: 180, distance_meters: 200 }),
    step('SUBWAY', { guidance: '수도권 3호선 (종로3가 > 동대입구)', stop_names: ['종로3가', '을지로3가', '충무로', '동대입구'], vehicle_names: ['수도권 3호선'] }),
    step('WALKING', { duration_seconds: 240, distance_meters: 250 }),
  ],
}
const ODSAY_BUS = {
  type: 'BUS',
  duration_seconds: 1800,
  distance_meters: 5200,
  transfers: 0,
  steps: [step('BUS', { guidance: '간선 273외 1대 (종로3가.탑골공원 > 동대입구역.장충동)', stop_names: ['종로3가.탑골공원', '동대입구역.장충동'], vehicle_names: ['273', '271'] })],
}

/** 경로 서버가 body 로 답하게 한다. 부른 주소를 모아 돌려준다 */
function serve(body, status = 200) {
  const calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      calls.push(String(url))
      if (String(url).startsWith('/routes/transit')) return { status, json: async () => body }
      return { status: 200, json: async () => ok(KIOSK) } // /api/v1/location
    }),
  )
  return calls
}

describe('경로 백업: 설정을 경로 서버에 알리기', () => {
  beforeEach(async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    clearOrigin()
    toPoi(DEST)
    vi.stubGlobal('navigator', {})
    serve([])
    await getLocation()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('처음 값이면 provider 를 넘기지 않는다 (서버가 알아서 카카오 먼저, 실패하면 ODsay)', async () => {
    const calls = serve([ODSAY_BUS])
    await route('SUB_0332_3호선', { now: at(14), backup: 'auto' })
    expect(calls).toEqual(['/routes/transit?start_latitude=37.5704&start_longitude=126.9918&end_latitude=37.55906&end_longitude=127.005273'])
  })

  it('백업을 끄면 provider=kakao, ODsay 로만 찾으면 provider=odsay 를 넘긴다', async () => {
    let calls = serve([ODSAY_BUS])
    await route('SUB_0332_3호선', { now: at(14), backup: 'off' })
    expect(calls[0]).toMatch(/&provider=kakao$/)
    calls = serve([ODSAY_BUS])
    await route('SUB_0332_3호선', { now: at(14), backup: 'only' })
    expect(calls[0]).toMatch(/&provider=odsay$/)
  })

  it('ODsay 에서 온 경로도 같은 화면 모양이 되고 노선색·버스색이 들어간다', async () => {
    serve([ODSAY_SUBWAY, ODSAY_BUS])
    const { routes } = await route('SUB_0332_3호선', { now: at(14), backup: 'auto' })
    expect(routes.map((r) => [r.id, r.durationMin])).toEqual([
      ['SUB_0332_3호선#1', 15],
      ['SUB_0332_3호선#2', 30],
    ])
    expect(routes[0].legs).toEqual([
      { mode: 'WALK', minutes: 3, to: { name: '종로3가역', kind: 'STATION' } },
      { mode: 'SUBWAY', lineId: 'seoul-3', label: '3', stops: 3, to: { name: '동대입구역', kind: 'STATION' } },
      { mode: 'WALK', minutes: 4, to: { name: '동대입구역', kind: 'STATION' } },
    ])
    expect(routes[1].legs).toEqual([{ mode: 'BUS', kind: 'TRUNK', number: '273', stops: 1, to: { name: '동대입구역.장충동', kind: 'STOP' } }])
    expect(toRouteGuide(routes).routes.map((r) => r.rides[0].color)).toEqual(['--line-seoul-3', '--bus-trunk'])
  })

  it('ODsay 에서 온 경로에도 운행 시간 거르기가 걸린다', async () => {
    const night = { ...ODSAY_BUS, steps: [step('BUS', { guidance: '간선 N37 (a > b)', stop_names: ['a', 'b'], vehicle_names: ['N37'] })] }
    serve([night, ODSAY_BUS])
    const day = await route('SUB_0332_3호선', { now: at(14), backup: 'auto' })
    expect(day.routes.map((r) => r.legs[0].number)).toEqual(['273'])
    const late = await route('SUB_0332_3호선', { now: at(1), backup: 'auto' })
    expect(late.routes.map((r) => r.legs[0].number)).toEqual(['N37', '273'])
  })

  it('서버가 실패하면(백업도 실패했거나 쓸 수 없을 때) 예전과 같은 오류', async () => {
    serve(null, 500)
    await expect(route('SUB_0332_3호선', { now: at(14), backup: 'auto' })).rejects.toMatchObject({ code: 'UPSTREAM' })
    serve({ detail: 'BACKUP_NOT_CONFIGURED: ODSAY_API_KEY is not set' }, 503)
    await expect(route('SUB_0332_3호선', { now: at(14), backup: 'only' })).rejects.toMatchObject({ code: 'UPSTREAM' })
  })
})
