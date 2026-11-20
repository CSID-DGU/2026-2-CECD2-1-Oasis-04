// 경로 시험 데이터. 확정 시안 design/mockups/confirmed/route-cases.js(ROUTE_CASES, ROUTE_SUBWAY)와
// route-guide-final.html 의 SETS(버스정류장 묶음, 긴 경로)를 그대로 옮겼다 (계획서 5-2절, 8단계).
// 모든 시간·버스 번호·출구 번호는 예시다. longcard 의 D·E, longthree 는 카드가 넘치는지 보려고 지어낸 길이다.
// 모양은 디자인 문서 9-2절 (view/routeView.js 머리 주석). via 는 지나는 역·정류장 이름(마지막이 내리는 곳)이고 개수만 쓴다.

const S = (name) => ({ name, kind: 'STATION' })
const P = (name) => ({ name, kind: 'STOP' })
const PL = (name) => ({ name, kind: 'PLACE' })
const sub = (lineId, label, via, to) => ({ mode: 'SUBWAY', lineId, label, via, to })
const bus = (kind, number, via, to) => ({ mode: 'BUS', kind, number, via, to })
const walk = (minutes, to) => ({ mode: 'WALK', minutes, ...(to ? { to } : {}) })

// 보통 경로 (환승 1회). 종로3가역 → 명동역
export const ROUTE_A = { id: 'A', durationMin: 12, exit: '6', start: S('종로3가역'), legs: [sub('seoul-3', '3', ['을지로3가', '충무로'], S('충무로역')), walk(3), sub('seoul-4', '4', ['명동'], S('명동역'))] }
export const ROUTE_B = { id: 'B', durationMin: 17, exit: '6', start: S('종로3가역'), legs: [sub('seoul-1', '1', ['종각', '시청', '서울역'], S('서울역')), walk(5), sub('seoul-4', '4', ['회현', '명동'], S('명동역'))] }
export const ROUTE_C = { id: 'C', durationMin: 19, exit: '6', start: S('종로3가역'), legs: [sub('seoul-5', '5', ['을지로4가', '동대문역사문화공원'], S('동대문역사문화공원역')), walk(6), sub('seoul-4', '4', ['충무로', '명동'], S('명동역'))] }

/** 지하철역 기본 묶음 (시안 ?set=subway): 종로3가역 → 명동역 3개 */
export const ROUTE_SUBWAY = [ROUTE_A, ROUTE_B, ROUTE_C]

const BUS_START = P('종로3가.탑골공원')

/** 버스정류장 묶음 (시안 기본 SETS.bus). start.dir(타는 방향)은 선택 항목이고 화면에 보이지 않는다 */
export const ROUTE_BUS = [
  {
    id: 'bus-only', durationMin: 14, start: { ...BUS_START, dir: 'SAME' },
    legs: [bus('TRUNK', '472', ['종로2가', '종각', '광교', '을지로입구', '명동성당', '명동입구'], P('명동입구'))],
  },
  {
    id: 'bus-subway', durationMin: 16, exit: '6', start: { ...BUS_START, dir: 'ACROSS' },
    legs: [bus('BRANCH', '7011', ['종로3가역', '을지로3가', '충무로역'], P('충무로역')), walk(3, S('충무로역')), sub('seoul-4', '4', ['명동'], S('명동역'))],
  },
  {
    id: 'subway-bus', durationMin: 21, start: BUS_START,
    legs: [walk(4, S('종로3가역')), sub('seoul-1', '1', ['종각', '시청', '서울역'], S('서울역')), walk(3, { ...P('서울역'), dir: 'SAME' }), bus('TRUNK', '405', ['숭례문', '명동입구'], P('명동입구'))],
  },
]

/** 긴 경로 (시안 ?set=long): 환승 2회, 긴 정류장 이름 */
export const ROUTE_LONG = {
  id: 'long', durationMin: 38, start: { ...BUS_START, dir: 'ACROSS' },
  legs: [
    bus('EXPRESS', '9401-1', ['종로5가', '동대문', '서울특별시립동대문역사문화공원.국립중앙의료원앞'], P('서울특별시립동대문역사문화공원.국립중앙의료원앞')),
    walk(4, S('동대문역사문화공원역')),
    sub('seoul-4', '4', ['충무로'], S('충무로역')),
    walk(3, { ...P('충무로역.매일경제'), dir: 'ACROSS' }),
    bus('BRANCH', '7011', ['퇴계로3가', '명동입구'], P('명동입구')),
  ],
}

/** 시안 route-cases.js 의 ROUTE_CASES (경우 10가지. 8번은 출구 없음, 9번은 탈것 3개 모두 긴 이름) */
export const ROUTE_CASES = {
  // 1. 환승 3회 (걷는 구간 포함). 이 경로 하나만 온다 (환승 2회 이하 경로가 없는 경우)
  transfer3: [
    {
      id: 'T3', durationMin: 41, start: S('종로3가역'),
      legs: [
        sub('seoul-1', '1', ['종각', '시청', '서울역'], S('서울역')),
        walk(5),
        sub('arex', '공항철도', ['공덕'], S('공덕역')),
        walk(4),
        sub('gyeongui-jungang', '경의중앙', ['서강대'], S('서강대역')),
        walk(3, P('서강대역')),
        bus('BRANCH', '7016', ['신촌오거리.현대백화점', '연세대앞'], P('연세대앞')),
      ],
    },
  ],
  // 2. 경로가 1개만, 2개만
  one: [ROUTE_A],
  two: [ROUTE_A, ROUTE_B],
  // 3. 걸어서만 가는 경로 (카카오 응답에는 없다. 지금 앱은 가까우면 경로를 찾지 않는다, R4)
  walk: [{ id: 'W', durationMin: 6, start: S('종로3가역'), legs: [walk(6, PL('탑골공원'))] }],
  // 4. 카드의 노선 줄이 긴 경우: D 는 환승 3회, E 는 환승 2회지만 번호 없는 노선과 긴 버스 번호
  longcard: [
    {
      id: 'D', durationMin: 29, start: S('종로3가역'),
      legs: [
        sub('seoul-1', '1', ['종각', '시청', '서울역'], S('서울역')),
        walk(3, P('서울역')),
        bus('TRUNK', '405', ['숭례문', '회현역'], P('회현역')),
        walk(2, S('회현역')),
        sub('seoul-4', '4', ['명동'], S('명동역')),
        walk(3, P('명동역')),
        bus('BRANCH', '7011', ['명동입구'], P('명동입구')),
      ],
    },
    {
      id: 'E', durationMin: 33, start: S('종로3가역'),
      legs: [
        sub('arex', '공항철도', ['공덕'], S('공덕역')),
        walk(4, P('공덕역')),
        bus('EXPRESS', '9401-1', ['마포역', '공덕오거리'], P('공덕오거리')),
        walk(3, S('공덕역')),
        sub('gyeongui-jungang', '경의중앙', ['서강대'], S('서강대역')),
      ],
    },
    ROUTE_A,
  ],
  // 5. 긴 이름
  longname: [
    {
      id: 'L', durationMin: 27, start: S('종로3가역'),
      legs: [
        sub('seoul-5', '5', ['을지로4가', '동대문역사문화공원'], S('동대문역사문화공원역')),
        walk(4, P('동대문역사문화공원역.국립중앙의료원')),
        bus('EXPRESS', '9401-1', ['신당역.중앙시장앞', '서울특별시립중부노인전문요양원앞'], P('서울특별시립중부노인전문요양원앞')),
      ],
    },
    ROUTE_A,
    ROUTE_B,
  ],
  // 6. 번호 없는 노선 (공항철도, 경의중앙선)
  named: [
    { id: 'N1', durationMin: 24, exit: '1', start: S('종로3가역'), legs: [sub('seoul-5', '5', ['광화문', '서대문', '충정로', '애오개', '공덕'], S('공덕역')), walk(4), sub('gyeongui-jungang', '경의중앙', ['서강대'], S('서강대역'))] },
    { id: 'N2', durationMin: 22, exit: '1', start: S('종로3가역'), legs: [sub('seoul-1', '1', ['종각', '시청', '서울역'], S('서울역')), walk(5), sub('arex', '공항철도', ['공덕'], S('공덕역'))] },
    ROUTE_A,
  ],
  // 7. 목적지가 역이 아닌 장소. 내리는 역에서 걸어간다
  place: [
    { ...ROUTE_A, id: 'A7', durationMin: 17, legs: [...ROUTE_A.legs, walk(5, PL('서울병원'))] },
    { ...ROUTE_B, id: 'B7', durationMin: 22, legs: [...ROUTE_B.legs, walk(5, PL('서울병원'))] },
  ],
  // 8. 출구 번호가 없다
  noexit: [{ ...ROUTE_A, id: 'A8', exit: null }, ROUTE_B],
  // 9. 탈것 3개가 모두 긴 이름
  longthree: [
    {
      id: 'LT', durationMin: 38, start: S('종로3가역'),
      legs: [
        sub('arex', '공항철도', ['공덕'], S('공덕역')),
        walk(4, P('공덕역')),
        bus('EXPRESS', '9401-1', ['마포역', '공덕오거리'], P('공덕오거리')),
        walk(3, S('공덕역')),
        sub('gyeongui-jungang', '경의중앙선', ['서강대'], S('서강대역')),
      ],
    },
    ROUTE_A,
    ROUTE_B,
  ],
}
