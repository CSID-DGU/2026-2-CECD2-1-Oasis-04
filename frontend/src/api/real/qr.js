// '휴대폰으로 보내기' 의 실제 구현. 따로 서버를 부르지 않고, 방금 조회한 경로의 출발·도착지로 route.js 가 만든
// 카카오맵 길찾기 주소를 돌려준다. 휴대폰에서 열면 카카오맵이 같은 출발·도착지로 길을 보여 준다.
// 서버가 경로마다 landing_url 을 주면 고른 경로(routeId)의 주소를 쓴다 (team-requests #7, 11단계). 없으면 마지막 조회의 주소 하나.
// QR 그림은 화면(QrBox)이 이 주소로 그린다 (team-requests #10).
//   주소가 없음 (경로 조회 전이거나 경로를 찾지 못함) → Error('QR_ERROR')  (화면에 오류 문구만 표시, 전이 없음)

import { landingUrlOf } from './route.js'

export async function createQr(routeId) {
  const url = landingUrlOf(routeId)
  if (!url) throw new Error('QR_ERROR')
  return { url }
}
