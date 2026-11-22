// view/routeView.js: 확정 시안 route-cases.js 의 경우 10가지 + 버스정류장 묶음 + 긴 경로 + real 응답 (계획서 8단계)
import { describe, it, expect } from 'vitest'
import { toRouteGuide, toRouteView, timelineOf, stopsSentence, arriveAt, clockText, NO_COLOR } from '../routeView.js'
import { ROUTE_CASES, ROUTE_SUBWAY, ROUTE_BUS, ROUTE_LONG, ROUTE_A } from '../../api/mock/data/routeCases.js'
import { ROUTES as MOCK_ROUTES } from '../../api/mock/data/routes.js'
import { legsFromSteps, startFromSteps, destinationPlace, subwayLineId } from '../../api/real/routeLegs.js'

/** 타임라인을 읽기 쉬운 글자 줄로: 점은 "[라벨] 이름", 걷기는 "~ 글", 타기는 "= 표지 문장", 접기는 "… N" */
const lines = (items) =>
  items.map((it) => {
    if (it.type === 'stop') return `[${it.role}] ${it.place.name}${it.exit ? ` (${it.exit}번 출구)` : ''}`
    if (it.type === 'walk') return `~ ${it.text}`
    if (it.type === 'ride') return `= ${it.leg.text} ${it.leg.stopsText}`
    return `… ${it.more}`
  })
const marks = (view) => view.rides.map((l) => `${l.mark}:${l.text}:${l.color}`)

describe('R1 환승 2회 이하만, 최대 3개', () => {
  it('지하철역 묶음 A·B·C 는 그대로 3개, 카드', () => {
    const g = toRouteGuide(ROUTE_SUBWAY)
    expect(g.routes.map((r) => [r.id, r.durationMin, r.transfers])).toEqual([['A', 12, 1], ['B', 17, 1], ['C', 19, 1]])
    expect(g).toMatchObject({ single: false, fallback: false, given: 3 })
  })
  it('1. 환승 3회 경로만 오면 그 하나를 요약 판으로, 타임라인은 접는다 (fallback)', () => {
    const g = toRouteGuide(ROUTE_CASES.transfer3)
    expect(g).toMatchObject({ single: true, fallback: true })
    const [r] = g.routes
    expect(r.transfers).toBe(3)
    expect(lines(r.timeline.folded)).toEqual([
      '[타는 곳] 종로3가역',
      '= 1 3번째 역에서 내려요',
      '… 2',
      '[갈아타는 곳] 서강대역',
      '= 7016 2번째 정류장에서 내려요',
      '[내리는 곳] 연세대앞',
    ])
  })
  it('4. 환승 3회 경로(D)는 빼고 나머지 2개', () => {
    expect(toRouteGuide(ROUTE_CASES.longcard).routes.map((r) => r.id)).toEqual(['E', 'A'])
  })
  it('넷 이상이면 앞의 3개, 빈 목록이면 빈 결과', () => {
    expect(toRouteGuide([...ROUTE_SUBWAY, ROUTE_A]).routes).toHaveLength(3)
    expect(toRouteGuide([])).toMatchObject({ routes: [], single: false, fallback: false })
  })
})

describe('R3 경로 1개·2개', () => {
  it('2-1. 하나면 요약 판(single), 2-2. 둘이면 카드', () => {
    expect(toRouteGuide(ROUTE_CASES.one).single).toBe(true)
    expect(toRouteGuide(ROUTE_CASES.two)).toMatchObject({ single: false })
    expect(toRouteGuide(ROUTE_CASES.two).routes).toHaveLength(2)
  })
})

describe('보통 경로의 타임라인과 라벨', () => {
  it('A: 같은 역 안 환승은 그 역에 "갈아타는 곳", 마지막에 "내리는 곳"과 출구', () => {
    const r = toRouteView(ROUTE_A)
    expect(lines(r.timeline.full)).toEqual([
      '[타는 곳] 종로3가역',
      '= 3 2번째 역에서 내려요',
      '[갈아타는 곳] 충무로역',
      '~ 걸어서 3분',
      '= 4 다음 역에서 내려요',
      '[내리는 곳] 명동역 (6번 출구)',
    ])
    expect(marks(r)).toEqual(['circle:3:--line-seoul-3', 'circle:4:--line-seoul-4'])
    expect(r).toMatchObject({ hasExit: true, exit: '6', walkOnly: false, hasBus: false, endsAtPlace: false, lastWalk: null })
    expect(r.timeline.folded).toBeNull() // 탈것이 2개 이하면 접을 것이 없다
  })
  it('버스정류장 묶음: 먼저 걸으면 "지금 계신 곳", 걸어간 곳은 "타는 곳"/"갈아타는 곳", 버스는 정류장으로 센다', () => {
    const [busOnly, busSubway, subwayBus] = toRouteGuide(ROUTE_BUS).routes
    expect(lines(busOnly.timeline.full)).toEqual(['[타는 곳] 종로3가.탑골공원', '= 472 6번째 정류장에서 내려요', '[내리는 곳] 명동입구'])
    expect(busOnly.hasExit).toBe(false)
    expect(lines(busSubway.timeline.full)).toEqual([
      '[타는 곳] 종로3가.탑골공원',
      '= 7011 3번째 정류장에서 내려요',
      '[] 충무로역',
      '~ 걸어서 3분',
      '[갈아타는 곳] 충무로역',
      '= 4 다음 역에서 내려요',
      '[내리는 곳] 명동역 (6번 출구)',
    ])
    expect(lines(subwayBus.timeline.full)).toEqual([
      '[지금 계신 곳] 종로3가.탑골공원',
      '~ 걸어서 4분',
      '[타는 곳] 종로3가역',
      '= 1 3번째 역에서 내려요',
      '[] 서울역',
      '~ 걸어서 3분',
      '[갈아타는 곳] 서울역',
      '= 405 2번째 정류장에서 내려요',
      '[내리는 곳] 명동입구',
    ])
    expect(marks(busSubway)).toEqual(['bus:7011:--bus-branch', 'circle:4:--line-seoul-4'])
  })
  it('R2-② 걸어서 갈아타는 곳을 한 줄로 (merged)', () => {
    const subwayBus = toRouteView(ROUTE_BUS[2])
    expect(lines(subwayBus.timeline.merged)).toEqual([
      '[지금 계신 곳] 종로3가.탑골공원',
      '~ 걸어서 4분',
      '[타는 곳] 종로3가역',
      '= 1 3번째 역에서 내려요',
      '~ 서울역에서 내려 걸어서 3분',
      '[갈아타는 곳] 서울역',
      '= 405 2번째 정류장에서 내려요',
      '[내리는 곳] 명동입구',
    ])
  })
  it('긴 경로(환승 2회): 접기 단계도 미리 만든다', () => {
    const r = toRouteView(ROUTE_LONG)
    expect(r.transfers).toBe(2)
    expect(lines(r.timeline.folded)).toEqual([
      '[타는 곳] 종로3가.탑골공원',
      '= 9401-1 3번째 정류장에서 내려요',
      '… 1',
      '[갈아타는 곳] 충무로역.매일경제',
      '= 7011 2번째 정류장에서 내려요',
      '[내리는 곳] 명동입구',
    ])
  })
})

describe('경우별 (route-cases.js)', () => {
  it('3. 걸어서만: 카드에 "걸어서", 지금 계신 곳 → 걸어서 N분 → 가실 곳 (R4)', () => {
    const r = toRouteGuide(ROUTE_CASES.walk).routes[0]
    expect(r).toMatchObject({ walkOnly: true, transfers: 0, endsAtPlace: true })
    expect(lines(r.timeline.full)).toEqual(['[지금 계신 곳] 종로3가역', '~ 걸어서 6분', '[가실 곳] 탑골공원'])
  })
  it('4. E: 번호 없는 노선은 평평한 표지·회색, 긴 버스 번호는 그대로 (R6, 3-6절)', () => {
    const e = toRouteView(ROUTE_CASES.longcard[1])
    expect(marks(e)).toEqual([`tag:공항철도:${NO_COLOR}`, 'bus:9401-1:--bus-express', `tag:경의중앙:${NO_COLOR}`])
  })
  it('5. 긴 이름: 이름은 자르지 않고 그대로 넘긴다 (줄이기는 화면 부품)', () => {
    const l = toRouteView(ROUTE_CASES.longname[0])
    expect(l.dest).toEqual({ name: '서울특별시립중부노인전문요양원앞', kind: 'STOP' })
    expect(lines(l.timeline.full)).toContain('[갈아타는 곳] 동대문역사문화공원역.국립중앙의료원')
  })
  it('6. 번호 없는 노선 두 가지와 출구 1번', () => {
    const [n1, n2] = toRouteGuide(ROUTE_CASES.named).routes
    expect(marks(n1)).toEqual(['circle:5:--line-seoul-5', `tag:경의중앙:${NO_COLOR}`])
    expect(marks(n2)[1]).toBe(`tag:공항철도:${NO_COLOR}`)
    expect(n1.timeline.full.at(-1)).toMatchObject({ role: '내리는 곳', exit: '1' })
    expect(lines(n1.timeline.full)[1]).toBe('= 5 5번째 역에서 내려요')
  })
  it('7. 목적지가 장소: 내리는 곳과 출구 → 걸어서 N분 → 가실 곳 (R7)', () => {
    const r = toRouteGuide(ROUTE_CASES.place).routes[0]
    expect(r).toMatchObject({ endsAtPlace: true, lastWalk: { minutes: 5, to: { name: '서울병원', kind: 'PLACE' } } })
    expect(lines(r.timeline.full).slice(-3)).toEqual(['[내리는 곳] 명동역 (6번 출구)', '~ 걸어서 5분', '[가실 곳] 서울병원'])
  })
  it('8. 출구 번호가 없으면 아무것도 쓰지 않는다 (R8)', () => {
    const [a8, b] = toRouteGuide(ROUTE_CASES.noexit).routes
    expect(a8).toMatchObject({ exit: null, hasExit: false })
    expect(a8.timeline.full.at(-1).exit).toBeNull()
    expect(b.hasExit).toBe(true)
  })
  it('9. 탈것 3개 모두 긴 이름: 환승 2회라 그대로 보이고, 접기도 미리 만든다', () => {
    const lt = toRouteGuide(ROUTE_CASES.longthree).routes[0]
    expect(lt.transfers).toBe(2)
    expect(lt.rides.map((l) => l.text)).toEqual(['공항철도', '9401-1', '경의중앙선'])
    expect(lt.timeline.folded).not.toBeNull()
  })
})

describe('작은 규칙', () => {
  it('구간 문장: 1 이면 "다음", 모르면 null', () => {
    expect(stopsSentence('SUBWAY', 1)).toBe('다음 역에서 내려요')
    expect(stopsSentence('BUS', 4)).toBe('4번째 정류장에서 내려요')
    expect(stopsSentence('BUS', null)).toBeNull()
  })
  it('모르는 버스 종류·노선 ID 는 회색 (사라지지 않는다)', () => {
    const r = toRouteView({ id: 'x', durationMin: 5, legs: [{ mode: 'BUS', kind: 'AIRPORT', number: '6002', stops: 2, to: { name: 'a', kind: 'STOP' } }, { mode: 'SUBWAY', lineId: null, label: '3', stops: 1, to: { name: 'b역', kind: 'STATION' } }] })
    expect(marks(r)).toEqual([`bus:6002:${NO_COLOR}`, `circle:3:${NO_COLOR}`])
  })
  it('마을버스는 지선과 같은 초록 (2026-11-22)', () => {
    const r = toRouteView({ id: 'x', durationMin: 5, legs: [{ mode: 'BUS', kind: 'VILLAGE', number: '종로09', stops: 2, to: { name: 'a', kind: 'STOP' } }] })
    expect(marks(r)).toEqual(['bus:종로09:--bus-branch'])
  })
  it('경기버스는 경기버스 색: 일반 초록, 좌석 파랑, 직행 빨강 (2026-11-22)', () => {
    const leg = (kind, number) => ({ mode: 'BUS', kind, number, stops: 2, to: { name: 'a', kind: 'STOP' } })
    const r = toRouteView({ id: 'x', durationMin: 5, legs: [leg('GG_GENERAL', '11'), leg('GG_SEAT', '300'), leg('GG_DIRECT', '5000')] })
    expect(marks(r)).toEqual(['bus:11:--bus-gg-general', 'bus:300:--bus-gg-seat', 'bus:5000:--bus-gg-direct'])
  })
  it('start 가 없으면 지금 계신 곳(here)', () => {
    const r = toRouteView({ id: 'x', legs: [{ mode: 'WALK', minutes: 2, to: { name: '종로3가역', kind: 'STATION' } }, ROUTE_A.legs[0]] }, { here: { name: '종로3가역 키오스크', kind: 'PLACE' } })
    expect(r.start.name).toBe('종로3가역 키오스크')
    expect(r.durationMin).toBeNull()
  })
  it('도착 시각 = 지금 + 소요 시간', () => {
    const now = new Date('2026-11-19T14:30:00')
    expect(clockText(arriveAt({ durationMin: 12 }, now))).toBe('오후 2:42')
    expect(clockText(arriveAt({ durationMin: 40 }, new Date('2026-11-19T11:30:00')))).toBe('오후 12:10')
    expect(arriveAt({}, now)).toBeNull()
  })
  it('timelineOf 는 화면용 모양을 받는다', () => {
    expect(timelineOf(toRouteView(ROUTE_A), 1)).toEqual(toRouteView(ROUTE_A).timeline.full)
  })
  it('mock api 의 경로 3개도 같은 모양으로 바뀐다', () => {
    expect(toRouteGuide(MOCK_ROUTES).routes.map((r) => [r.id, r.durationMin, r.transfers])).toEqual([['route-1', 12, 1], ['route-2', 17, 1], ['route-3', 19, 1]])
  })
})

// ---------------------------------------------------------------- real 응답
// ① 이 브랜치의 GET /api/v1/route (server/routing.py build_steps 결과)
const REAL_V1_STEPS = [
  { order: 1, mode: 'WALK', minutes: 1, distance_m: 40, easy_text: '종로3가역까지 40미터 걸어가세요.' },
  { order: 2, mode: 'SUBWAY', minutes: 6, line: '3호선', board: '종로3가', alight: '교대', stops: 9, easy_text: '' },
  { order: 3, mode: 'WALK', minutes: 2, distance_m: 120, easy_text: '교대역에서 2호선으로 갈아타세요.' },
  { order: 4, mode: 'SUBWAY', minutes: 6, line: '2호선', board: '교대', alight: '선릉', stops: 3, easy_text: '' },
  { order: 5, mode: 'WALK', minutes: 4, distance_m: 300, easy_text: '1번 출구로 나와서 걸어가세요.' },
  { order: 6, mode: 'BUS', minutes: 8, line: '273', bus_type: '간선', board: '선릉역', alight: '역삼세무서', stops: 4, line_alternatives: ['N13'], easy_text: '' },
  { order: 7, mode: 'WALK', minutes: 3, distance_m: 200, easy_text: '' },
]
// ② feature/backend-route 의 GET /routes/transit (server/kakao_transit.py)
const step = (type, extra = {}) => ({ type, guidance: '', duration_seconds: 600, distance_meters: 3000, stop_names: [], vehicle_names: [], ...extra })
const REAL_TRANSIT_STEPS = [
  step('WALKING', { duration_seconds: 50, distance_meters: 40, stop_names: ['종로3가역'] }),
  step('SUBWAY', { stop_names: ['종로3가', '을지로3가', '교대'], vehicle_names: ['수도권 3호선'] }),
  step('WALKING', { duration_seconds: 90, distance_meters: 100, guidance: '환승' }),
  step('SUBWAY', { stop_names: ['교대', '강남', '역삼', '선릉'], vehicle_names: ['수도권 2호선'] }),
  step('BUS', { duration_seconds: 2400, stop_names: ['선릉역', '역삼세무서'], vehicle_names: ['8641(평일)', '273'] }),
]

describe('real 응답 → 같은 모양', () => {
  it('① /api/v1/route: 버스 종류·정거장 수·내리는 곳·걷는 시간, 노선 ID 는 노선 이름으로, 출구는 비움', () => {
    const destination = destinationPlace({ poi_id: 'POI_123', name: '강남세브란스병원' })
    const legs = legsFromSteps(REAL_V1_STEPS, { destination })
    expect(legs).toEqual([
      { mode: 'WALK', minutes: 1, to: { name: '종로3가역', kind: 'STATION' } },
      { mode: 'SUBWAY', lineId: 'seoul-3', label: '3', stops: 9, to: { name: '교대역', kind: 'STATION' } },
      { mode: 'WALK', minutes: 2 },
      { mode: 'SUBWAY', lineId: 'seoul-2', label: '2', stops: 3, to: { name: '선릉역', kind: 'STATION' } },
      { mode: 'WALK', minutes: 4, to: { name: '선릉역', kind: 'STOP' } },
      { mode: 'BUS', kind: 'TRUNK', number: '273', stops: 4, to: { name: '역삼세무서', kind: 'STOP' } },
      { mode: 'WALK', minutes: 3, to: { name: '강남세브란스병원', kind: 'PLACE' } },
    ])
    expect(startFromSteps(REAL_V1_STEPS)).toBeNull()
    const g = toRouteGuide([{ id: 'r1', durationMin: 31, exit: null, start: null, legs }], { here: { name: '종로3가역 키오스크', kind: 'PLACE' } })
    const [r] = g.routes
    expect(r.transfers).toBe(2)
    expect(marks(r)).toEqual(['circle:3:--line-seoul-3', 'circle:2:--line-seoul-2', 'bus:273:--bus-trunk'])
    expect(r).toMatchObject({ hasExit: false, endsAtPlace: true })
    expect(lines(r.timeline.full)).toEqual([
      '[지금 계신 곳] 종로3가역 키오스크',
      '~ 걸어서 1분',
      '[타는 곳] 종로3가역',
      '= 3 9번째 역에서 내려요',
      '[갈아타는 곳] 교대역',
      '~ 걸어서 2분',
      '= 2 3번째 역에서 내려요',
      '[] 선릉역',
      '~ 걸어서 4분',
      '[갈아타는 곳] 선릉역',
      '= 273 4번째 정류장에서 내려요',
      '[내리는 곳] 역삼세무서',
      '~ 걸어서 3분',
      '[가실 곳] 강남세브란스병원',
    ])
  })
  it('② /routes/transit: WALKING → WALK, stop_names 로 정거장 수, 조건 없는 버스 번호, 안내 문구가 없으면 버스 종류는 없음(회색)', () => {
    const legs = legsFromSteps(REAL_TRANSIT_STEPS, { destination: destinationPlace({ poi_id: 'BUS_1', name: '역삼세무서' }) })
    expect(legs).toEqual([
      { mode: 'WALK', minutes: 1, to: { name: '종로3가역', kind: 'STATION' } },
      { mode: 'SUBWAY', lineId: 'seoul-3', label: '3', stops: 2, to: { name: '교대역', kind: 'STATION' } },
      { mode: 'WALK', minutes: 2 },
      { mode: 'SUBWAY', lineId: 'seoul-2', label: '2', stops: 3, to: { name: '선릉역', kind: 'STATION' } },
      { mode: 'BUS', kind: null, number: '273', stops: 1, to: { name: '역삼세무서', kind: 'STOP' } },
    ])
    const r = toRouteView({ id: 'r', durationMin: 31, legs })
    expect(marks(r)).toEqual(['circle:3:--line-seoul-3', 'circle:2:--line-seoul-2', `bus:273:${NO_COLOR}`])
    expect(r.legs[4].stopsText).toBe('다음 정류장에서 내려요')
  })
  it('② 노선 색: 노선 이름으로 노선 ID 를 정한다. 다른 지역 노선과 모르는 이름은 비운다 (2026-11-22)', () => {
    const idOf = (name) => legsFromSteps([step('SUBWAY', { stop_names: ['a', 'b'], vehicle_names: [name] })])[0].lineId
    expect(['3호선', '수도권 1호선', '9호선', '공항철도', '경의중앙선', '수인분당선', 'GTX-A', '신분당선'].map(idOf)).toEqual([
      'seoul-3', 'seoul-1', 'seoul-9', 'arex', 'gyeongui-jungang', 'suin-bundang', 'gtx-a', 'sinbundang',
    ])
    expect(['인천 1호선', '부산 3호선', '10호선', '모르는선', ''].map(idOf)).toEqual([null, null, null, null, null])
    expect(subwayLineId('수도권 5호선')).toBe('seoul-5')
    // 서버가 노선 ID 를 주면 그것을 쓴다
    expect(legsFromSteps([step('SUBWAY', { line_id: 'seoul-7', stop_names: ['a', 'b'], vehicle_names: ['모르는선'] })])[0].lineId).toBe('seoul-7')
  })
  it('② 버스 색: 카카오 안내 문구의 앞머리로 종류를 정한다 (2026-11-22)', () => {
    const bus = (guidance, vehicle_names) => {
      const leg = legsFromSteps([step('BUS', { guidance, stop_names: ['a', 'b'], vehicle_names })])[0]
      return [leg.number, leg.kind]
    }
    expect(bus('간선 271외 7대 (종로3가역.탑골공원 > 충정로역(중))', ['271', '273', 'N26(심야)'])).toEqual(['271', 'TRUNK'])
    expect(bus('지선 7212 (종로4가.종묘 > 장충동.동국대입구)', ['7212'])).toEqual(['7212', 'BRANCH'])
    expect(bus('광역 M5107외 1대 (명동성당 > 영통역)', ['M5107', 'M5107'])).toEqual(['M5107', 'EXPRESS'])
    // 경기버스: 일반·좌석·직행은 경기버스 종류로 (경기버스 색)
    expect(bus('직행 5000외 4대 (명동성당 > 기흥역8번출구)', ['5000', '5005'])).toEqual(['5000', 'GG_DIRECT'])
    expect(bus('직행 G8110외 1대 (종로2가.삼일교(중) > 서현역.AK플라자)', ['G8110', 'G8110'])).toEqual(['G8110', 'GG_DIRECT'])
    expect(bus('일반 11 (광교중앙역 > 수원역)', ['11'])).toEqual(['11', 'GG_GENERAL'])
    expect(bus('좌석 300 (a > b)', ['300'])).toEqual(['300', 'GG_SEAT'])
    expect(bus('순환 01B외 1대 (충무로역2번출구 > 남산서울타워)', ['01B', '01B'])).toEqual(['01B', 'CIRCULAR'])
    expect(bus('마을 종로12 (종로3가역9번출구 > 창덕궁)', ['종로12'])).toEqual(['종로12', 'VILLAGE'])
    expect(bus('공항 6002 (종로3가역11번출구 > 인천공항T1-3층)', ['6002'])).toEqual(['6002', 'AIRPORT'])
    expect(bus('간선 N37(심야) (종로2가.삼일교 > 신사역)', ['N37(심야)'])).toEqual(['N37(심야)', 'TRUNK'])
    // 색을 정하지 않은 종류
    expect(bus('시외 8851 (수원터미널 > 수원역)', ['8851'])).toEqual(['8851', null])
    // 문구의 첫 버스가 조건이 붙어 다른 번호를 골랐으면 종류를 모른다
    expect(bus('지선 8641(평일)외 1대 (선릉역 > 역삼세무서)', ['8641(평일)', '273'])).toEqual(['273', null])
    const r = toRouteView({ id: 'r', legs: legsFromSteps([step('BUS', { guidance: '간선 271 (a > b)', stop_names: ['a', 'b'], vehicle_names: ['271'] })]) })
    expect(marks(r)).toEqual(['bus:271:--bus-trunk'])
  })
  it('먼저 걷지 않으면 첫 차를 타는 곳이 출발 장소, 이름 없는 노선은 평평한 표지', () => {
    const steps = [step('SUBWAY', { stop_names: ['서울역', '공덕'], vehicle_names: ['공항철도'] })]
    expect(startFromSteps(steps)).toEqual({ name: '서울역', kind: 'STATION' })
    expect(marks(toRouteView({ id: 'r', legs: legsFromSteps(steps) }))).toEqual([`tag:공항철도:${NO_COLOR}`])
  })
})
