// POST /location 의 mock. 지금 계신 곳 (첫 화면의 큰 띠, 다른 화면의 얇은 띠).
// 상태 전이를 일으키지 않는 표시용 조회라서 LocationContext 가 직접 부른다 (getPois·createQr 와 같은 예외).
// real 구현은 브라우저 위치(GPS)를 서버에 알리고 가까운 정류장 이름을 받아 온다. mock 은 DevPanel 에서 고른 장소를 돌려준다
// (api/mock/data/places.js: 지하철역(기본) / 버스정류장 / 정보 없음 + 띠 시험 데이터).
//
// place: 디자인 문서 8-5절 형식. 정보 없음이면 null (큰 띠가 "지금 계신 곳을 확인하고 있어요")

import { mockDelay } from './mockDelay.js'
import { currentMockPlace } from './data/places.js'

export async function getLocation() {
  console.log('[mock] getLocation 호출')
  await mockDelay()
  const place = currentMockPlace()
  const name = place?.name ?? ''
  return {
    name,
    text: name ? `지금 계신 곳: ${name}` : '',
    source: 'GPS',
    snapped: true,
    accuracyM: 15,
    reason: null,
    place,
  }
}
