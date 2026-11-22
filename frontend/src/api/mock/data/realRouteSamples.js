// real 경로 응답의 예시 두 가지 (개발자 패널 '경로 묶음' 의 real-v1, real-transit). 서버 없이 화면을 보려고 둔다 (9단계).
// 서버 모양은 계획서 4-5절. 값은 view/__tests__/routeView.test.js 의 'real 응답' 예시와 같은 길(종로3가 → 선릉 → 역삼세무서)이다.
// 바꾸는 것은 실제 코드(api/real/route.js 의 routesFromV1, api/real/routeLegs.js)를 그대로 쓴다.
// 서버가 주지 않는 값은 대체 동작대로다 (api/real/routeLegs.js): 노선 ID 는 노선 이름으로 정해 원에 노선색이 들어가고(2026-11-22),
// ② 의 버스 종류는 안내 문구(guidance)가 비어 있는 이 예시에서는 알 수 없어 테두리가 회색이다. 출구는 없다.

import { routesFromV1 } from '../../real/route.js'
import { legsFromSteps, startFromSteps } from '../../real/routeLegs.js'

// ① 이 브랜치의 GET /api/v1/route 의 data (server/routing.py)
const V1_DATA = {
  destination: { poi_id: 'POI_123', name: '강남세브란스병원', x: 127.04, y: 37.49 },
  landing_url: 'https://map.kakao.com/',
  routes: [
    {
      rank: 1, total_min: 31, transfers: 2,
      steps: [
        { order: 1, mode: 'WALK', minutes: 1, distance_m: 40 },
        { order: 2, mode: 'SUBWAY', minutes: 6, line: '3호선', board: '종로3가', alight: '교대', stops: 9 },
        { order: 3, mode: 'WALK', minutes: 2, distance_m: 120 },
        { order: 4, mode: 'SUBWAY', minutes: 6, line: '2호선', board: '교대', alight: '선릉', stops: 3 },
        { order: 5, mode: 'WALK', minutes: 4, distance_m: 300 },
        { order: 6, mode: 'BUS', minutes: 8, line: '273', bus_type: '간선', board: '선릉역', alight: '역삼세무서', stops: 4 },
        { order: 7, mode: 'WALK', minutes: 3, distance_m: 200 },
      ],
    },
    {
      rank: 2, total_min: 35, transfers: 0,
      steps: [
        { order: 1, mode: 'WALK', minutes: 2, distance_m: 120 },
        { order: 2, mode: 'BUS', minutes: 30, line: '9401', bus_type: '광역', board: '종로3가', alight: '역삼세무서' },
        { order: 3, mode: 'WALK', minutes: 3, distance_m: 200 },
      ],
    },
  ],
}

// ② feature/backend-route 의 GET /routes/transit (server/kakao_transit.py). 버스 종류·출구·목적지 없음
const step = (type, extra = {}) => ({ type, guidance: '', duration_seconds: 600, distance_meters: 3000, stop_names: [], vehicle_names: [], ...extra })
const TRANSIT = [
  {
    duration_seconds: 2400, transfers: 2,
    steps: [
      step('WALKING', { duration_seconds: 50, distance_meters: 40, stop_names: ['종로3가역'] }),
      step('SUBWAY', { stop_names: ['종로3가', '을지로3가', '교대'], vehicle_names: ['수도권 3호선'] }),
      step('WALKING', { duration_seconds: 90, distance_meters: 100, guidance: '환승' }),
      step('SUBWAY', { stop_names: ['교대', '강남', '역삼', '선릉'], vehicle_names: ['수도권 2호선'] }),
      step('BUS', { duration_seconds: 840, stop_names: ['선릉역', '역삼세무서'], vehicle_names: ['8641(평일)', '273'] }),
    ],
  },
  {
    duration_seconds: 1500, transfers: 0,
    steps: [step('SUBWAY', { duration_seconds: 1500, stop_names: ['종로3가', '종각', '시청'], vehicle_names: ['수도권 1호선'] })],
  },
]

/** ① 을 실제 변환으로 바꾼 경로 목록 */
export const REAL_V1_ROUTES = Object.freeze(routesFromV1(V1_DATA, 'POI_123'))

/** ② 를 바꾼 경로 목록. 합칠 때 api/real/route.js 가 같은 일을 하게 된다 (소요 시간은 분으로 올림) */
export const REAL_TRANSIT_ROUTES = Object.freeze(
  TRANSIT.map((r, i) => ({
    id: `transit#${i + 1}`,
    durationMin: Math.ceil(r.duration_seconds / 60),
    exit: null,
    start: startFromSteps(r.steps),
    legs: legsFromSteps(r.steps),
  })),
)
