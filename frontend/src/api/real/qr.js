// '휴대폰으로 보내기' 의 실제 구현. 따로 서버를 부르지 않고, 방금 조회한 경로에 서버가 함께 준
// 카카오맵 길찾기 주소(landing_url)를 돌려준다. 휴대폰에서 열면 카카오맵이 같은 출발·도착지로 길을 보여 준다.
// QR 이미지를 서버가 만들지 프론트가 그릴지는 아직 정해지지 않았다 (계획서 6절 2번). 지금 화면은 주소를 글자로 보여 준다.
//   주소가 없음 (경로 조회 전이거나 서버가 주지 않음) → Error('QR_ERROR')  (화면에 오류 문구만 표시, 전이 없음)

import { getLastLandingUrl } from './route.js'

export async function createQr() {
  const url = getLastLandingUrl()
  if (!url) throw new Error('QR_ERROR')
  return { url }
}
