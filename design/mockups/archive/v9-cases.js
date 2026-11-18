// 띠를 시험하려고 만든 장소 정보 (시안 전용). 주소에 ?case=이름 을 붙여 고른다: v8-test.html?case=seoul
// 형식은 README 의 v4 절과 같다. prev·next 는 가까운 역부터 적은 배열이다 (문자열 하나도 받는다. 종점이면 null 이나 빈 배열).
// 확실하지 않은 것: 노선색 값 전부, 버스 번호 전부(예시), 역 번호. 앞뒤 역 이름과 노선 구성은 아는 범위에서 맞췄다.
//   - 서울역의 GTX-A, 경의중앙선은 운행 구간이 바뀌었을 수 있다 (확인 필요)
//   - 오금은 3호선의 종점이다. 강동은 5호선이 갈라지는 역이다 (길동 쪽 / 둔촌동 쪽)
window.V8_CASES = {
  // 기준: 지금 시안의 종로3가
  jongno3ga: {
    type: 'SUBWAY_STATION',
    name: '종로3가역',
    lines: [
      { lineId: 'seoul-1', label: '1', prev: '종각', next: '종로5가' },
      { lineId: 'seoul-3', label: '3', prev: '안국', next: '을지로3가' },
      { lineId: 'seoul-5', label: '5', prev: '광화문', next: '을지로4가' },
    ],
  },
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
  // 노선 5개, 번호 없는 노선 3개, 종점 2개 (공항철도·경의중앙선은 서울역에서 시작한다)
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
  // 갈림길 (5호선이 강동에서 둘로 갈라진다). 규칙만 정했고 아직 그리지 않는다. 지금은 배열을 '가까운 역, 그다음 역'으로 읽는다
  gangdong: {
    type: 'SUBWAY_STATION',
    name: '강동역',
    lines: [{ lineId: 'seoul-5', label: '5', prev: '천호', next: ['길동', '둔촌동'] }],
  },
  // 기준: 지금 시안의 버스정류장. 번호는 예시다
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
  // 순환버스: 노랑이 띠 바탕과 구별되는지 보려고. 번호는 예시다
  buscircular: {
    type: 'BUS_STOP',
    name: '남산도서관 정류장',
    example: true,
    buses: [
      { kind: 'TRUNK', numbers: ['402', '405'] },
      { kind: 'CIRCULAR', numbers: ['01A', '01B'] },
    ],
  },
  // 버스 종류 6가지, 종류마다 번호 8개 이상. 번호는 모두 예시다
  busmany: {
    type: 'BUS_STOP',
    name: '종로3가.탑골공원 정류장',
    example: true,
    buses: [
      { kind: 'TRUNK', numbers: ['101', '103', '143', '150', '160', '201', '260', '270', '271', '273'] },
      { kind: 'BRANCH', numbers: ['7212', '7025', '1020', '1711', '7016', '7018', '7022', '7024'] },
      { kind: 'EXPRESS', numbers: ['9301', '9401', '9401-1', '9701', '9703', '9710', '9710-1', '9714'] },
      { kind: 'CIRCULAR', numbers: ['01A', '01B', '02', '03', '04', '05', '06', '07'] },
      { kind: 'VILLAGE', numbers: ['종로01', '종로02', '종로03', '종로05', '종로07', '종로08', '종로09', '종로11'] },
      { kind: 'NIGHT', numbers: ['N26', 'N15', 'N62', 'N13', 'N16', 'N30', 'N37', 'N61'] },
    ],
  },
  // 가장 긴 이름 + 버스 번호 많음. 이름은 지어낸 것이다
  buslong: {
    type: 'BUS_STOP',
    name: '서울특별시립동대문역사문화공원.국립중앙의료원앞 정류장',
    example: true,
    buses: [
      { kind: 'TRUNK', numbers: ['101', '103', '143', '150', '160', '201', '260', '270', '271', '273'] },
      { kind: 'BRANCH', numbers: ['7212', '7025', '1020', '1711', '7016', '7018', '7022', '7024'] },
      { kind: 'EXPRESS', numbers: ['9301', '9401', '9401-1', '9701', '9703', '9710', '9710-1', '9714'] },
      { kind: 'VILLAGE', numbers: ['종로01', '종로02', '종로03', '종로05', '종로07', '종로08', '종로09', '종로11'] },
      { kind: 'NIGHT', numbers: ['N26', 'N15', 'N62', 'N13', 'N16', 'N30', 'N37', 'N61'] },
    ],
  },
}
