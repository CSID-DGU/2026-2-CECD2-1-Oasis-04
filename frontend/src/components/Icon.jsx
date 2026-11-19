// 아이콘 하나 (디자인 문서 3-7절). 버튼·카드·알림의 아이콘은 Material Symbols 이고, 색은 옆 글자와 같다(currentColor).
// 아이콘만 있는 버튼은 금지다: 이 부품은 늘 글자 옆에 둔다. 그림만으로 뜻을 전하지 않으므로 화면 읽기 프로그램에는 숨긴다.
//
// props
//   name       src/assets/icons/ 의 파일 이름 (예: 'mic', 'home', 'schedule', 'logo')
//   className  크기는 쓰는 쪽 CSS 가 정한다 (예: 버튼 CSS 의 --btn-icon). 정하지 않으면 글자 크기(1em)
//
// 파일 내용은 우리가 넣어 둔 SVG 뿐이라 dangerouslySetInnerHTML 로 그대로 넣어도 안전하다 (사용자 입력이 아니다).

import { MATERIAL_ICONS } from './iconSource.js'
import './Icon.css'

export default function Icon({ name, className = '' }) {
  const icon = MATERIAL_ICONS[name]
  if (!icon) {
    console.warn(`[Icon] 없는 아이콘: ${name}`)
    return null
  }
  return (
    <svg
      className={`icon ${className}`.trim()}
      viewBox={icon.viewBox}
      fill={icon.fill ?? undefined}
      stroke={icon.stroke ?? undefined}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: icon.inner }}
    />
  )
}
