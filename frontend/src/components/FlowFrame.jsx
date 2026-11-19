// 조작 화면 7개의 새 틀: 얇은 띠 + 좌우 두 칸 (디자인 문서 6절, 시안 shared/flow.css). 예전 ScreenFrame 을 대신한다.
//   왼쪽 칸  x 140 에서 오른쪽 칸 앞 64px 까지. 이 화면의 내용 (left)
//   오른쪽 칸 너비 600, 오른쪽·아래 여백 48. 버튼을 세로 한 줄로 아래쪽에 붙인다. '처음으로'는 늘 맨 아래
//
// props
//   left      왼쪽 칸 내용
//   actions   오른쪽 칸 버튼 (주 버튼이 있으면 맨 위)
//   showHome  true 면 맨 아래에 '처음으로'(HomeButton). GO_HOME 전이가 있는 화면에서만 켠다
//   rightTop  오른쪽 칸 위쪽에 붙는 것 (ROUTE_GUIDE 의 경로 카드, 9-1 R3). 없으면 그리지 않는다
//
// 화면 제목(screens/titles.js)은 이 틀이 그리지 않는다. 제목이 필요한 화면은 left 안에 직접 둔다
// (LISTENING 은 제목 없이 "듣고 있어요"가 제목 역할, 10-1절)

import ThinBand from './ThinBand.jsx'
import HomeButton from './HomeButton.jsx'
import './FlowFrame.css'

export default function FlowFrame({ left, actions = null, showHome = false, rightTop = null }) {
  return (
    <section className="flow">
      <ThinBand />
      <div className="flow-body">
        <main className="flow-left">{left}</main>
        {rightTop && <div className="flow-right-top">{rightTop}</div>}
        {(actions || showHome) && (
          <div className="flow-right">
            {actions}
            {showHome && <HomeButton />}
          </div>
        )}
      </div>
    </section>
  )
}
