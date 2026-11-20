// 고르는 카드 묶음: CONFIRMING 후보(1열), MANUAL_SELECT 목적지(3열 4줄) (디자인 문서 11-1절, 6절, 시안 pick.css).
// 묶음 전체를 주 버튼 하나로 센다 (2절 예외). 누르면 바로 다음 화면으로 간다 (고른 상태 표시는 없다).
//
// props
//   variant   'confirm' (CONFIRMING: 이름 48px, 카드 높이 168, 1열)
//             'select'  (MANUAL_SELECT: 이름 36px, 높이는 내용을 따른다, 3열)
//   children  PickCard 들
// 크기 차이는 모두 PickList.css 의 variant 클래스가 정한다 (화면 파일에는 숫자를 쓰지 않는다)

import './PickList.css'

export default function PickList({ variant = 'confirm', children }) {
  return <ul className={`pick-list is-${variant}`}>{children}</ul>
}
