// 가짜 목적지. 계획서 6절 1번(서버 vs 내장)이 미정이라 mock 데이터로 둔다.
//
// MANUAL_POIS  손으로 고르기(MANUAL_SELECT) 목록 12개. 확정 시안 design/mockups/confirmed/manual-select-final.html 의 POIS 와
//              같은 이름·분류·순서다 (계획서 5-2절). 3열 4줄에 맞춘 개수라 여기에 더 넣지 않는다
// MYEONGDONG   "명동" 후보 3개. 시연 흐름 1번(demo.html), 시안 confirming-final.html ?set=myeongdong 의 CANDIDATES
// LONG_POIS    긴 이름 시험용 12개 (시안 ?names=long, 지어낸 목록). mock 시나리오 longNames 에서만 쓴다
// POIS         말로 찾을 수 있는 모든 목적지 (resolve mock 의 "정확히 일치"와 "병원" 후보가 쓴다).
//              예전부터 있던 서울역·병원 3개 등과 시험용 '외딴섬 선착장'(경로 없음)은 그대로 남긴다

export const MANUAL_POIS = Object.freeze([
  { id: 'poi-jonggak', name: '종각역', category: '지하철 1호선' },
  { id: 'poi-euljiro3ga', name: '을지로3가역', category: '지하철 2호선' },
  { id: 'poi-anguk', name: '안국역', category: '지하철 3호선' },
  { id: 'poi-euljiro4ga', name: '을지로4가역', category: '지하철 2호선' },
  { id: 'poi-jongno5ga', name: '종로5가역', category: '지하철 1호선' },
  { id: 'poi-gwanghwamun', name: '광화문역', category: '지하철 5호선' },
  { id: 'poi-euljiro-ipgu', name: '을지로입구역', category: '지하철 2호선' },
  { id: 'poi-city-hall-station', name: '시청역', category: '지하철 1호선' },
  { id: 'poi-chungmuro', name: '충무로역', category: '지하철 3호선' },
  { id: 'poi-ddp-station', name: '동대문역사문화공원역', category: '지하철 2호선' },
  { id: 'poi-myeongdong-station', name: '명동역', category: '지하철 4호선' },
  { id: 'poi-dongdaemun-station', name: '동대문역', category: '지하철 1호선' },
])

export const MYEONGDONG = Object.freeze([
  MANUAL_POIS.find((p) => p.name === '명동역'),
  { id: 'poi-myeongdong-cathedral', name: '명동성당', category: '성당' },
  { id: 'poi-myeongdong-ipgu', name: '명동입구', category: '버스정류장' },
])

export const LONG_POIS = Object.freeze(
  [
    ['서울대학교병원', '종합병원'],
    ['국립현대미술관 서울관', '미술관'],
    ['동대문디자인플라자', '문화시설'],
    ['서울특별시청 서소문청사', '관공서'],
    ['국립중앙의료원 장례식장', '장례식장'],
    ['종로구 노인복지관', '복지시설'],
    ['을지로입구역', '지하철 2호선'],
    ['서울특별시 동부병원 응급의료센터', '종합병원'],
    ['청계천', '관광지'],
    ['동대문역사문화공원역', '지하철 2호선'],
    ['명동역', '지하철 4호선'],
    ['남대문시장', '시장'],
  ].map(([name, category], i) => ({ id: `poi-long-${i + 1}`, name, category })),
)

const OTHER_POIS = [
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
]

export const POIS = Object.freeze([...OTHER_POIS, ...MANUAL_POIS, ...MYEONGDONG.slice(1)])
