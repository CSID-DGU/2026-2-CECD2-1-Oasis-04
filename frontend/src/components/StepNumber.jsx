// 단계 번호 원 (QR_HANDOFF 단계 안내, 디자인 문서 12-5절, 시안 qr-handoff-final.html 의 .step-no).
// 글꼴의 ①②③ 대신 ROUTE_GUIDE 노선 번호 원(LineMark)과 같은 모양: 52px, 흰 바탕, 본문색 테두리 6px, 검정 숫자 30px.
// props: n (번호)

import './StepNumber.css'

export default function StepNumber({ n }) {
  return <span className="step-number">{n}</span>
}
