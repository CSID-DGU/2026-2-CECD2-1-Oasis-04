// 가짜 목적지 목록. 계획서 6절 1번(서버 vs 내장)이 미정이라 mock 데이터로 둔다.
// 이름은 resolve mock 의 "정확히 일치" 매칭에도 쓰인다.
// 'poi-no-route' 는 route mock 에서 "경로 없음" 을 유발하는 특수 항목이다.

export const POIS = Object.freeze([
  { id: 'poi-seoul-station', name: '서울역', category: '지하철역' },
  { id: 'poi-city-hall', name: '시청', category: '지하철역' },
  { id: 'poi-dongguk-univ', name: '동국대학교', category: '학교' },
  { id: 'poi-namsan-tower', name: '남산타워', category: '관광지' },
  { id: 'poi-express-terminal', name: '고속터미널', category: '터미널' },
  { id: 'poi-hospital-a', name: '동국대병원', category: '병원' },
  { id: 'poi-hospital-b', name: '서울병원', category: '병원' },
  { id: 'poi-hospital-c', name: '중앙병원', category: '병원' },
  { id: 'poi-market', name: '남대문시장', category: '시장' },
  { id: 'poi-no-route', name: '외딴섬 선착장', category: '테스트(경로 없음)' },
])
