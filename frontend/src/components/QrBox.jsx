// QR 상자 (QR_HANDOFF, 디자인 문서 12-5절, 시안 qr-handoff-final.html 의 .qr-box).
// 그림 480 + 사방 흰 여백 40 = 흰 상자 560, 2px 보조색 테두리, 모서리 24.
//
// props
//   status  'loading' | 'ready' | 'error'
//   url     ready 일 때 휴대폰으로 넘길 주소. 이 주소로 QR 무늬를 만든다 (view/qrMatrix.js, 인터넷 없이)
//   message loading·error 일 때 상자 가운데에 보일 글. 시안에 그 모양이 없어 지금 문구를 글자로 둔다
//           (옮기기 계획 6-1절 #9. 글씨는 MANUAL_SELECT 불러오는 중·오류(12-4절)와 같게: 불러오는 중 36px, 오류 48px 굵게 오류 색)

import { useMemo } from 'react'
import { qrMatrix } from '../view/qrMatrix.js'
import './QrBox.css'

export default function QrBox({ status, url = null, message = '' }) {
  const matrix = useMemo(() => (status === 'ready' ? qrMatrix(url) : null), [status, url])

  return (
    <div className="qr-box" data-status={status}>
      {matrix ? (
        // 무늬 + 둘레 여백(matrix.quiet 칸)을 상자 안쪽 전체(그림 + 여백 40px × 2)에 그린다 (12-5절 'QR 조용한 여백')
        <svg
          className="qr-box-code"
          viewBox={`${-matrix.quiet} ${-matrix.quiet} ${matrix.size + matrix.quiet * 2} ${matrix.size + matrix.quiet * 2}`}
          role="img"
          aria-label="휴대폰으로 볼 길 안내 QR"
        >
          <path d={matrix.path} fill="currentColor" />
        </svg>
      ) : (
        <p className={status === 'error' ? 'qr-box-error' : 'qr-box-wait'} role="status">
          {message}
        </p>
      )}
    </div>
  )
}
