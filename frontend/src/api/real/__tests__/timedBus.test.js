// 특정 시간대에만 다니는 버스 가리기 (2026-11-22): 다니는 시간대의 10분 전 ~ 10분 뒤, 정해진 요일에만 그 버스로 가는 경로를 보인다.
// 환경: node. 경로 조회까지 보는 테스트는 real.test.js 처럼 fetch 를 가짜로 바꿔 끼운다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NIGHT_BUS_HOURS, busRunning, isNightBus, isTimedBus, kstDay, kstMinutes, nightBusRunning, runningRoutes } from '../timedBus.js'
import { route } from '../route.js'
import { getLocation, clearOrigin } from '../location.js'
import { toPoi } from '../poi.js'

// 2026-11-21 토, 22 일, 23 월, 24 화, 25 수
const SAT = 21
const SUN = 22
const MON = 23
const TUE = 24
const WED = 25
/** 한국 시각 2026년 11월 day일 h시 m분 */
const at = (day, h, m = 0) => new Date(Date.UTC(2026, 10, day, h - 9, m))
/** 요일이 상관없는 테스트용 (일요일) */
const kst = (h, m = 0) => at(SUN, h, m)

const step = (type, extra = {}) => ({ type, guidance: '', duration_seconds: 600, distance_meters: 3000, stop_names: [], vehicle_names: [], ...extra })
const NIGHT_ONLY = {
  duration_seconds: 1500,
  transfers: 0,
  steps: [step('BUS', { guidance: '간선 N37(심야) (종로2가 > 신사역.푸른저축은행)', stop_names: ['종로2가', '신사역.푸른저축은행'], vehicle_names: ['N37(심야)'] })],
}
const MIXED = {
  duration_seconds: 1800,
  transfers: 0,
  steps: [step('BUS', { guidance: '간선 271외 2대 (종로3가역.탑골공원 > 충정로역)', stop_names: ['종로3가역.탑골공원', '충정로역'], vehicle_names: ['271', '273', 'N26(심야)'] })],
}
const SUBWAY_ROUTE = {
  duration_seconds: 1860,
  transfers: 0,
  steps: [step('SUBWAY', { stop_names: ['종로3가', '을지로3가', '교대'], vehicle_names: ['3호선'] })],
}
const DAWN_ONLY = { duration_seconds: 1400, transfers: 0, steps: [step('BUS', { guidance: '간선 새벽A741 (종로2가 > 신사역)', stop_names: ['종로2가', '신사역'], vehicle_names: ['새벽A741'] })] }
const COMMUTE_ONLY = { duration_seconds: 1700, transfers: 0, steps: [step('BUS', { guidance: '간선 8101(출근) (a > b)', stop_names: ['a', 'b'], vehicle_names: ['8101(출근)'] })] }
const WEEKDAY_MIXED = { duration_seconds: 2400, transfers: 0, steps: [step('BUS', { stop_names: ['선릉역', '역삼세무서'], vehicle_names: ['8641(평일)', '273'] })] }

describe('어떤 버스가 시간 한정인가', () => {
  it('심야버스: 카카오가 "(심야)" 를 붙였거나 표에 있는 번호', () => {
    expect(['N37(심야)', 'N37', '심야A21(심야)'].map(isNightBus)).toEqual([true, true, true])
  })
  it('N 으로 시작해도 "(심야)" 가 없고 표에 없으면 심야버스가 아니다 (고양 마을버스 N002)', () => {
    expect(['N002', '271', '9401', '새벽A160', '8641(평일)', ''].map(isNightBus)).toEqual([false, false, false, false, false, false])
  })
  it('출근·퇴근·출퇴근·평일·공휴일제외 표시와 "새벽" 으로 시작하는 버스', () => {
    expect(['8101(출근)', '100(퇴근)', '062B(출퇴근)', '8641(평일)', '8541(공휴일제외)', '새벽A741', 'N37(심야)'].map(isTimedBus)).toEqual([
      true, true, true, true, true, true, true,
    ])
  })
  it('표시가 없는 버스와 모르는 표시는 시간 한정이 아니다', () => {
    expect(['271', 'N002', '급행150', '종로12', '100(임시)', ''].map(isTimedBus)).toEqual([false, false, false, false, false, false])
  })
  it('심야버스 표는 서울시 안내의 14개 노선', () => {
    expect(Object.keys(NIGHT_BUS_HOURS)).toHaveLength(14)
    for (const [first, last] of Object.values(NIGHT_BUS_HOURS)) {
      expect(first).toMatch(/^(23|00):[0-5]\d$/)
      expect(last).toMatch(/^0[34]:[0-5]\d$/)
    }
  })
})

describe('한국 시각', () => {
  it('자정부터 몇 분인지와 요일', () => {
    expect(kstMinutes(kst(0, 5))).toBe(5)
    expect(kstMinutes(kst(23, 50))).toBe(23 * 60 + 50)
    expect([SAT, SUN, MON].map((d) => kstDay(at(d, 0, 30)))).toEqual([6, 0, 1])
    expect(kstDay(at(MON, 23, 59))).toBe(1)
  })
})

describe('심야버스: 첫차 10분 전 ~ 막차 10분 뒤', () => {
  it('N37 (첫차 00:00, 막차 03:10): 23:50 부터 03:20 까지', () => {
    const run = (h, m) => nightBusRunning('N37(심야)', kst(h, m))
    expect([run(23, 49), run(23, 50), run(0, 0), run(2, 0), run(3, 20), run(3, 21), run(14, 0)]).toEqual([false, true, true, true, true, false, false])
  })
  it('N30 (첫차 23:10, 막차 03:50): 23:00 부터 04:00 까지', () => {
    const run = (h, m) => nightBusRunning('N30', kst(h, m))
    expect([run(22, 59), run(23, 0), run(4, 0), run(4, 1)]).toEqual([false, true, true, false])
  })
  it('표에 없는 심야버스는 가장 이른 첫차(23:10) ~ 가장 늦은 막차(04:10)로 본다', () => {
    const run = (h, m) => busRunning('심야A21(심야)', kst(h, m))
    expect([run(22, 59), run(23, 0), run(4, 20), run(4, 21), run(12, 0)]).toEqual([false, true, true, false, false])
  })
  it('여유 시간을 바꿀 수 있다', () => {
    expect(nightBusRunning('N37', kst(23, 30), 30)).toBe(true)
    expect(nightBusRunning('N37', kst(23, 59), 0)).toBe(false)
  })
  it('요일과 상관없이 매일 다닌다', () => {
    expect([SAT, SUN, MON].map((d) => busRunning('N37(심야)', at(d, 1, 0)))).toEqual([true, true, true])
  })
})

describe('출근·퇴근 버스: 평일의 그 시간대 10분 전 ~ 10분 뒤', () => {
  it('(출근) 은 평일 05:50 부터 09:10 까지', () => {
    const run = (h, m) => busRunning('8101(출근)', at(MON, h, m))
    expect([run(5, 49), run(5, 50), run(7, 30), run(9, 10), run(9, 11), run(18, 0)]).toEqual([false, true, true, true, false, false])
  })
  it('(퇴근) 은 평일 16:50 부터 20:10 까지', () => {
    const run = (h, m) => busRunning('100(퇴근)', at(TUE, h, m))
    expect([run(16, 49), run(16, 50), run(18, 0), run(20, 10), run(20, 11), run(7, 30)]).toEqual([false, true, true, true, false, false])
  })
  it('(출퇴근) 은 두 시간대 모두', () => {
    const run = (h, m) => busRunning('062B(출퇴근)', at(WED, h, m))
    expect([run(7, 30), run(12, 0), run(18, 0), run(22, 0)]).toEqual([true, false, true, false])
  })
  it('주말에는 그 시간대여도 다니지 않는다', () => {
    expect([SAT, SUN].map((d) => busRunning('8101(출근)', at(d, 7, 30)))).toEqual([false, false])
    expect(busRunning('062B(출퇴근)', at(SAT, 18, 0))).toBe(false)
  })
})

describe('요일만 정해진 버스와 새벽 버스', () => {
  it('(평일) 은 월~금 하루 종일', () => {
    expect([MON, WED, SAT, SUN].map((d) => busRunning('8641(평일)', at(d, 14, 0)))).toEqual([true, true, false, false])
    expect(busRunning('8641(평일)', at(MON, 2, 0))).toBe(true)
  })
  it('(공휴일제외) 는 일요일만 가린다', () => {
    expect([MON, SAT, SUN].map((d) => busRunning('8541(공휴일제외)', at(d, 14, 0)))).toEqual([true, true, false])
  })
  it('"새벽" 으로 시작하는 버스는 평일 03:20 부터 05:10 까지', () => {
    const run = (h, m) => busRunning('새벽A741', at(TUE, h, m))
    expect([run(3, 19), run(3, 20), run(4, 0), run(5, 10), run(5, 11), run(14, 0)]).toEqual([false, true, true, true, false, false])
    expect(busRunning('새벽A160', at(SAT, 3, 30))).toBe(false)
  })
  it('표시가 없는 버스와 모르는 표시는 늘 다니는 것으로 본다', () => {
    expect(['271', 'N002', '급행150', '100(임시)'].map((n) => busRunning(n, at(SUN, 3, 0)))).toEqual([true, true, true, true])
  })
})

describe('runningRoutes: 경로에서 지금 못 타는 버스 빼기', () => {
  it('낮에는 심야버스만 가는 경로를 빼고, 다른 버스가 함께 있으면 심야버스만 뺀다', () => {
    const out = runningRoutes([NIGHT_ONLY, MIXED, SUBWAY_ROUTE], at(MON, 14, 0))
    expect(out).toHaveLength(2)
    expect(out[0].steps[0].vehicle_names).toEqual(['271', '273'])
    expect(out[1]).toEqual(SUBWAY_ROUTE)
    expect(MIXED.steps[0].vehicle_names).toEqual(['271', '273', 'N26(심야)']) // 받은 배열은 그대로
  })
  it('다니는 시간에는 그대로 둔다', () => {
    const out = runningRoutes([NIGHT_ONLY, MIXED, SUBWAY_ROUTE], at(MON, 1, 0))
    expect(out).toHaveLength(3)
    expect(out[0].steps[0]).toBe(NIGHT_ONLY.steps[0])
    expect(out[1].steps[0].vehicle_names).toEqual(['271', '273', 'N26(심야)'])
  })
  it('막차 10분 뒤를 넘기면 다시 뺀다. 노선마다 시간이 다르다', () => {
    // 03:22: N37(막차 03:10)은 끝났고 N26(막차 03:25)은 아직 다닌다
    const out = runningRoutes([NIGHT_ONLY, MIXED], at(MON, 3, 22))
    expect(out).toHaveLength(1)
    expect(out[0].steps[0].vehicle_names).toEqual(['271', '273', 'N26(심야)'])
  })
  it('낮에는 새벽 버스와 출근 버스로 가는 경로도 뺀다', () => {
    expect(runningRoutes([DAWN_ONLY, COMMUTE_ONLY, SUBWAY_ROUTE], at(MON, 14, 0))).toEqual([SUBWAY_ROUTE])
    expect(runningRoutes([DAWN_ONLY, COMMUTE_ONLY, SUBWAY_ROUTE], at(MON, 7, 30))).toEqual([COMMUTE_ONLY, SUBWAY_ROUTE])
    expect(runningRoutes([DAWN_ONLY, COMMUTE_ONLY, SUBWAY_ROUTE], at(MON, 4, 0))).toEqual([DAWN_ONLY, SUBWAY_ROUTE])
  })
  it('주말에는 (평일) 버스를 목록에서 뺀다', () => {
    expect(runningRoutes([WEEKDAY_MIXED], at(SUN, 14, 0))[0].steps[0].vehicle_names).toEqual(['273'])
    expect(runningRoutes([WEEKDAY_MIXED], at(MON, 14, 0))[0].steps[0].vehicle_names).toEqual(['8641(평일)', '273'])
  })
  it('시간 한정이 아닌 버스와 빈 목록은 건드리지 않는다', () => {
    const village = { steps: [step('BUS', { vehicle_names: ['N002', '33-1'] })] }
    expect(runningRoutes([village], at(MON, 14, 0))).toEqual([village])
    expect(runningRoutes([], at(MON, 14, 0))).toEqual([])
    expect(runningRoutes(null, at(MON, 14, 0))).toEqual([])
  })
})

describe('경로 조회에 적용', () => {
  const ok = (data) => ({ success: true, data, latency_ms: 1 })
  const mockFetch = (body, status = 200) => vi.stubGlobal('fetch', vi.fn(async () => ({ status, json: async () => body })))
  const DEST = { poi_id: 'SUB_0337_3호선', name: '신사', display_name: '신사역 (3호선)', poi_type: 'SUBWAY_STATION', x: 127.0203, y: 37.5163, distance_m: 6500, score: 0.95 }
  const KIOSK = { source: 'KIOSK', name: '종로3가역 키오스크', x: 126.9918, y: 37.5704, snapped: false, easy_text: '지금 계신 곳: 종로3가역 키오스크' }

  beforeEach(async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    clearOrigin()
    toPoi(DEST)
    vi.stubGlobal('navigator', {})
    mockFetch(ok(KIOSK))
    await getLocation()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('낮에는 새벽 버스·심야버스 경로가 빠지고 다음 경로가 첫째가 된다', async () => {
    mockFetch([DAWN_ONLY, NIGHT_ONLY, SUBWAY_ROUTE])
    const { routes } = await route('SUB_0337_3호선', { now: at(MON, 14, 0) })
    expect(routes.map((r) => [r.id, r.legs[0].mode, r.legs[0].number ?? r.legs[0].label])).toEqual([['SUB_0337_3호선#1', 'SUBWAY', '3']])
  })
  it('심야버스가 다니는 시간에는 그 경로도 나온다', async () => {
    mockFetch([NIGHT_ONLY, SUBWAY_ROUTE])
    const { routes } = await route('SUB_0337_3호선', { now: at(MON, 1, 0) })
    expect(routes.map((r) => [r.legs[0].mode, r.legs[0].number ?? r.legs[0].label, r.legs[0].kind ?? null])).toEqual([
      ['BUS', 'N37(심야)', 'TRUNK'],
      ['SUBWAY', '3', null],
    ])
  })
  it('남는 경로가 없으면 경로가 없는 것과 같다', async () => {
    mockFetch([NIGHT_ONLY, COMMUTE_ONLY])
    expect(await route('SUB_0337_3호선', { now: at(SUN, 14, 0) })).toEqual({ routes: [] })
  })
})
