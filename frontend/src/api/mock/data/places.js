// mock 장소 정보 (디자인 문서 8-5절 형식, 계획서 5-2절). 값은 확정 시안 그대로다.
//   PLACES      DevPanel 에서 고르는 세 가지: 지하철역(시연 기본) / 버스정류장 / 정보 없음
//               idle-final-subway.html, idle-final-bus.html, idle-final-default.html 의 window.PLACE
//   BAND_CASES  띠 규칙 시험 데이터 (노선 1·2·5개, 종점, 버스 6종류, 긴 이름). design/mockups/archive/v9-cases.js 그대로
//
// 확인하지 않은 것: 노선색, 버스 번호(모두 예시, docs/team-requests.md #12), 역 구성. 디자인 문서 8-6절
// example: true 는 "버스 번호는 예시" 표시를 띠에 보이라는 mock 전용 표시다 (서버 형식에는 없다)

export const PLACES = Object.freeze({
  subway: {
    type: 'SUBWAY_STATION',
    name: '종로3가역',
    lines: [
      { lineId: 'seoul-1', label: '1', prev: '종각', next: '종로5가' },
      { lineId: 'seoul-3', label: '3', prev: '안국', next: '을지로3가' },
      { lineId: 'seoul-5', label: '5', prev: '광화문', next: '을지로4가' },
    ],
  },
  bus: {
    type: 'BUS_STOP',
    name: '종로3가.탑골공원 정류장',
    example: true,
    buses: [
      { kind: 'TRUNK', numbers: ['101', '260', '270', '720'] },
      { kind: 'BRANCH', numbers: ['7212'] },
      { kind: 'EXPRESS', numbers: ['9301'] },
    ],
  },
  none: null,
})

/** DevPanel 에 보일 이름 */
export const PLACE_LABELS = Object.freeze({ subway: '지하철역 (종로3가역)', bus: '버스정류장 (종로3가.탑골공원)', none: '정보 없음' })

const MANY_BUSES = [
  { kind: 'TRUNK', numbers: ['101', '103', '143', '150', '160', '201', '260', '270', '271', '273'] },
  { kind: 'BRANCH', numbers: ['7212', '7025', '1020', '1711', '7016', '7018', '7022', '7024'] },
  { kind: 'EXPRESS', numbers: ['9301', '9401', '9401-1', '9701', '9703', '9710', '9710-1', '9714'] },
  { kind: 'CIRCULAR', numbers: ['01A', '01B', '02', '03', '04', '05', '06', '07'] },
  { kind: 'VILLAGE', numbers: ['종로01', '종로02', '종로03', '종로05', '종로07', '종로08', '종로09', '종로11'] },
  { kind: 'NIGHT', numbers: ['N26', 'N15', 'N62', 'N13', 'N16', 'N30', 'N37', 'N61'] },
]

export const BAND_CASES = Object.freeze({
  // 노선 1개
  anguk: {
    type: 'SUBWAY_STATION',
    name: '안국역',
    lines: [{ lineId: 'seoul-3', label: '3', prev: ['경복궁', '독립문'], next: ['종로3가', '을지로3가'] }],
  },
  // 노선 2개
  chungmuro: {
    type: 'SUBWAY_STATION',
    name: '충무로역',
    lines: [
      { lineId: 'seoul-3', label: '3', prev: ['을지로3가', '종로3가'], next: ['동대입구', '약수'] },
      { lineId: 'seoul-4', label: '4', prev: ['동대문역사문화공원', '동대문'], next: ['명동', '회현'] },
    ],
  },
  // 노선 5개, 번호 없는 노선 3개, 종점 3개
  seoul: {
    type: 'SUBWAY_STATION',
    name: '서울역',
    lines: [
      { lineId: 'seoul-1', label: '1', prev: '시청', next: '남영' },
      { lineId: 'seoul-4', label: '4', prev: '회현', next: '숙대입구' },
      { lineId: 'arex', label: '공항철도', prev: null, next: '공덕' },
      { lineId: 'gyeongui-jungang', label: '경의중앙', prev: null, next: '신촌' },
      { lineId: 'gtx-a', label: 'GTX-A', prev: null, next: '연신내' },
    ],
  },
  // 종점 (3호선은 오금에서 끝난다)
  ogeum: {
    type: 'SUBWAY_STATION',
    name: '오금역',
    lines: [
      { lineId: 'seoul-3', label: '3', prev: ['경찰병원', '가락시장'], next: [] },
      { lineId: 'seoul-5', label: '5', prev: ['방이', '올림픽공원'], next: ['개롱', '거여'] },
    ],
  },
  // 순환버스 (옅은 노랑 테두리)
  buscircular: {
    type: 'BUS_STOP',
    name: '남산도서관 정류장',
    example: true,
    buses: [
      { kind: 'TRUNK', numbers: ['402', '405'] },
      { kind: 'CIRCULAR', numbers: ['01A', '01B'] },
    ],
  },
  // 버스 종류 6가지, 종류마다 번호 8개 이상
  busmany: { type: 'BUS_STOP', name: '종로3가.탑골공원 정류장', example: true, buses: MANY_BUSES },
  // 가장 긴 이름 + 버스 번호 많음 (이름은 지어낸 것)
  buslong: {
    type: 'BUS_STOP',
    name: '서울특별시립동대문역사문화공원.국립중앙의료원앞 정류장',
    example: true,
    buses: MANY_BUSES.filter((g) => g.kind !== 'CIRCULAR'),
  },
})

// ---------- DevPanel 에서 고른 장소 (개발 도구. scenario.js 와 같은 모듈 변수) ----------

let current = 'subway'

export function getMockPlaceKey() {
  return current
}

/** key: PLACES 의 키, 또는 BAND_CASES 의 키 (띠 시험용) */
export function setMockPlaceKey(key) {
  if (!(key in PLACES) && !(key in BAND_CASES)) {
    console.warn(`[mock] 알 수 없는 장소 "${key}" → 무시`)
    return
  }
  current = key
}

export function currentMockPlace() {
  return current in PLACES ? PLACES[current] : BAND_CASES[current]
}
