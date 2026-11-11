// 모든 화면이 공유하는 틀 (계획서 3절 '공통 부품'). 제목 + 본문 + 버튼 영역 + 선택적 '처음으로'.
// Thymeleaf 의 layout 템플릿에 해당한다: 공통 뼈대는 여기 한 번만 쓰고, 화면마다 다른 부분(본문·버튼)만 끼워 넣는다.
//
// props
//   title     제목 (h1). 사람이 읽는 문구 (screens/titles.js 의 SCREEN_TITLES). 상태 이름은 DevPanel 에만 보인다
//   children  본문. <ScreenFrame> ... </ScreenFrame> 태그 사이에 쓴 것이 그대로 들어온다
//   actions   버튼 영역. 화면 고유 버튼들을 JSX 로 넘긴다. 없으면 영역을 그리지 않는다
//   showHome  true 일 때만 '처음으로'(GO_HOME) 버튼을 버튼 영역 끝에 붙인다
//             사용자가 조작하는 7개 화면(LISTENING, CONFIRMING, REASKING, UNAVAILABLE, MANUAL_SELECT, ROUTE_GUIDE, QR_HANDOFF)만 켠다.
//             스피너 화면 5개와 IDLE, IDLE_REDUCED 는 끈다 (표에 GO_HOME 전이가 없는 상태에서 버튼을 누르면 "표에 없는 전이" 경고가 난다)
//
// '처음으로' 는 여기서만 그린다. 화면 컴포넌트가 따로 GO_HOME 버튼을 만들지 않는다 (중복 방지).
// 디자인(글씨 크기·버튼 높이·대비)은 src/styles/global.css 가 .screen 아래에만 건다. 여기서는 className 만 붙인다.

import { useKiosk } from '../state/KioskContext.jsx'
import { EVENTS } from '../state/events.js'

export default function ScreenFrame({ title, children, actions = null, showHome = false }) {
  const { dispatch } = useKiosk()
  const hasActions = actions !== null || showHome

  return (
    <section className="screen">
      <h1 className="screen-title">{title}</h1>

      <div className="screen-body">{children}</div>

      {hasActions && (
        <div className="screen-actions">
          {actions}
          {showHome && (
            <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: EVENTS.GO_HOME })}>
              처음으로
            </button>
          )}
        </div>
      )}
    </section>
  )
}
