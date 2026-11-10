// ROUTE_GUIDE: 5 경로 안내 (계획서 3절). 휴대폰으로 보내기 / 처음으로. 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당 (Phase 5 4번).
//
// 보여 주는 데이터는 reducer 의 state.routes (ROUTING 핸들러가 ROUTE_FOUND 에 담아 준 /route 응답. 1순위가 첫 번째).
//   1순위      → 크게 (요약, 소요 시간, 환승 횟수)
//   2·3순위    → 작게. 표시만 하고 선택은 안 된다 (계획서 6절 8번 미정 → 임시 처리)
//   0개        → 안내 문구만 (정상 흐름에선 오지 않는다. 빈 배열이면 ROUTING 핸들러가 UNAVAILABLE 로 보낸다)
// 버튼: '휴대폰으로 보내기'(SEND_TO_PHONE_PRESSED) → QR_HANDOFF. '처음으로'(GO_HOME) 는 ScreenFrame 의 showHome 이 그린다.
//
// Route 구조는 백엔드와 합의 전이라 mock 의 최소 필드만 쓴다: { id, rank, summary, durationMin, transfers }.
// 필드가 없을 수도 있으므로(DevPanel 가짜 payload 등) 하나씩 있는지 확인하고 그린다.

import ScreenFrame from '../components/ScreenFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { SCREEN_TITLES } from './titles.js'

/** 소요 시간·환승을 한 줄 문구로. 값이 없는 항목은 뺀다. */
function detailsOf(route) {
  const parts = []
  if (typeof route.durationMin === 'number') parts.push(`약 ${route.durationMin}분`)
  if (typeof route.transfers === 'number') parts.push(route.transfers === 0 ? '환승 없음' : `환승 ${route.transfers}회`)
  return parts.join(' · ')
}

export default function RouteGuideScreen() {
  const { state, dispatch } = useKiosk()
  // 1순위가 첫 번째라는 응답 규약(계획서 7절)을 믿고 배열 순서대로 쓴다.
  const [best, ...others] = state.routes

  return (
    <ScreenFrame
      title={SCREEN_TITLES[STATES.ROUTE_GUIDE]}
      showHome
      actions={
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: EVENTS.SEND_TO_PHONE_PRESSED })}>
          휴대폰으로 보내기
        </button>
      }
    >
      <p>목적지: {state.selectedPoi?.name ?? '(없음)'}</p>

      {!best && <p>보여 드릴 경로가 없어요</p>}

      {best && (
        // 1순위: 제목 크기(40px)로 강조. 스타일은 global.css 의 .route-best. "이렇게 가세요" 는 화면 제목이 맡는다
        <div className="route-best">
          <div>{best.summary}</div>
          {detailsOf(best) && <div className="route-best-detail">{detailsOf(best)}</div>}
        </div>
      )}

      {others.length > 0 && (
        <>
          <p className="hint">다른 방법</p>
          {/* 선택 불가 → 버튼이 아니라 목록으로만 그린다 (계획서 6절 8번) */}
          <ol start={2} className="route-others">
            {others.map((route) => (
              <li key={route.id}>
                {route.summary}
                {detailsOf(route) && <small> ({detailsOf(route)})</small>}
              </li>
            ))}
          </ol>
        </>
      )}
    </ScreenFrame>
  )
}
