// POST /location 의 mock. 첫 화면의 '지금 계신 곳' 한 줄.
// 상태 전이를 일으키지 않는 표시용 조회라서 화면 컴포넌트가 직접 불러도 된다 (getPois·createQr 와 같은 예외).
// real 구현은 브라우저 위치(GPS)를 서버에 알리고 가까운 정류장 이름을 받아 온다. mock 은 정해 둔 한 곳을 돌려준다.

import { mockDelay } from './mockDelay.js'

export async function getLocation() {
  console.log('[mock] getLocation 호출')
  await mockDelay()
  const name = '종로3가.탑골공원 정류장'
  return { name, text: `지금 계신 곳: ${name}`, source: 'GPS', snapped: true, accuracyM: 15, reason: null }
}
