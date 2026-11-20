// 고리 가운데 그림 (디자인 문서 10-3절, 12-3절). 기다림 화면과 UNAVAILABLE 이 쓴다.
// 손 그림 다섯 가지(src/assets/icons/ring/)는 152 칸에 같은 선 굵기로 그렸다(3-7절). 시계는 손 그림이 아니라
// Material schedule 이다: 남은 시간 알림의 시계와 같은 모양이어야 하므로 (12-3절, consistency-audit 결정 6).
// 색은 본문색, 크기는 쓰는 쪽(고리 부품)이 정한다. 그림만으로 뜻을 전하지 않으므로 화면 읽기 프로그램에는 숨긴다.
//
// props
//   name       flag | bubble | logo | walk | pin | clock | mic
//   className  크기·자리

import { MATERIAL_ICONS, RING_DRAWINGS, RING_FROM_MATERIAL as FROM_MATERIAL } from './iconSource.js'
import './RingIcon.css'

export default function RingIcon({ name, className = '' }) {
  const material = FROM_MATERIAL[name]
  const drawing = material ? MATERIAL_ICONS[material] : RING_DRAWINGS[name]
  if (!drawing) {
    console.warn(`[RingIcon] 없는 그림: ${name}`)
    return null
  }
  return (
    <svg
      className={`ring-icon ${material ? 'is-fill-icon' : 'is-line'} ${className}`.trim()}
      viewBox={drawing.viewBox}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: drawing.inner }}
    />
  )
}
