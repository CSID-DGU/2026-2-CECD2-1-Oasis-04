// 주소 → QR 칸 무늬 (QR_HANDOFF, 디자인 문서 12-5절, 옮기기 계획 10단계).
// 인터넷 없이 브라우저에서 만든다: npm 패키지 qrcode-generator (MIT, 라이선스는 assets/licenses/qrcode-generator.LICENSE.txt).
// 누가 QR 을 만들지(docs/team-requests.md #10)가 정해지기 전의 대체 동작이다. 서버가 그림을 주게 되면 QrBox 만 바꾼다.
//
// 돌려주는 값: { size: 한 변의 칸 수, path: SVG path (검은 칸마다 1×1 네모) }. 조용한 여백(흰 테두리)은 넣지 않는다 —
// 시안처럼 QrBox 의 흰 상자 안쪽 여백(40px)이 그 몫이다. 주소가 비면 null.

import qrcode from 'qrcode-generator'

// 오류 정정 단계 M (약 15% 복구). 화면에 크게(480px) 보이므로 칸이 늘어나도 읽기 쉽다
const ERROR_CORRECTION = 'M'

export function qrMatrix(text) {
  if (!text) return null
  const qr = qrcode(0, ERROR_CORRECTION) // 0: 글자 길이에 맞춰 가장 작은 버전을 고른다
  qr.addData(text, 'Byte')
  qr.make()
  const size = qr.getModuleCount()
  let path = ''
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`
    }
  }
  return { size, path }
}
