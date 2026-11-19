// ROUTE_GUIDE: 5 경로 안내 (계획서 3절, 디자인 문서 9절, 확정 시안 route-guide-final.html).
// 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당이고, 남은 15초부터 띠에 알림을 보인다 (FlowFrame 의 countdown, 11-4절).
//
// 데이터: reducer 의 state.routes (ROUTING 핸들러가 ROUTE_FOUND 에 담아 준 /route 응답, 1순위가 첫 번째)를
//   view/routeView.js 의 toRouteGuide 로 바꾼 것만 쓴다. 어떤 경로를 보일지(R1), 카드인지 요약 판인지(R3),
//   라벨·구간 줄(R7·R8)은 거기서 정하고, 이 화면은 판단하지 않는다.
//   경로에 출발 장소(start)가 없으면(real) 지금 계신 곳 이름을 LocationContext 에서 가져와 띠와 같은 이름 규칙으로 쓴다.
//
// 왼쪽 칸: 제목 + 고른 경로의 타임라인 (Timeline 이 재서 줄이기 단계를 고른다, R2)
// 오른쪽 칸: 경로가 2~3개면 위쪽에 경로 카드, 1개면 요약 판을 버튼 바로 위에 (R3).
//   '휴대폰으로 보내기'(SEND_TO_PHONE_PRESSED) → QR_HANDOFF. '처음으로'(GO_HOME) 는 FlowFrame 의 showHome 이 그린다.
// 카드 고르기는 화면 안 상태(useState)다. 이벤트·reducer 는 그대로 (docs/kiosk-workflow.md "전이가 아닌 화면 안 동작").
//   처음에는 1순위. 고른 경로를 QR 로 보내는 것은 11단계에서 한다 (지금 QR 은 routes[0])

import { useMemo, useState } from 'react'
import FlowFrame from '../components/FlowFrame.jsx'
import PrimaryButton from '../components/PrimaryButton.jsx'
import RouteCard from '../components/RouteCard.jsx'
import RouteSummary from '../components/RouteSummary.jsx'
import Timeline from '../components/Timeline.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { useLocation } from '../state/LocationContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { toRouteGuide } from '../view/routeView.js'
import { bandPlaceName, PLACE_TYPES } from '../view/placeName.js'
import { SCREEN_TITLES } from './titles.js'
import './RouteGuideScreen.css'

const KIND_OF_PLACE_TYPE = { [PLACE_TYPES.SUBWAY_STATION]: 'STATION', [PLACE_TYPES.BUS_STOP]: 'STOP' }

/** 위치 조회 결과 → 타임라인 첫 점에 쓸 지금 계신 곳 { name, kind }. 이름이 없으면 null (routeView 가 '지금 계신 곳') */
function hereOf(location) {
  const name = bandPlaceName(location)
  if (!name) return null
  return { name, kind: KIND_OF_PLACE_TYPE[location?.place?.type] ?? 'PLACE' }
}

export default function RouteGuideScreen() {
  const { state, dispatch } = useKiosk()
  const { location } = useLocation()
  // 경로나 위치 결과가 바뀔 때만 다시 만든다 (타임라인이 그때만 다시 잰다)
  const guide = useMemo(() => toRouteGuide(state.routes, { here: hereOf(location) }), [state.routes, location])
  const [picked, setPicked] = useState({ index: 0, byTap: false })
  const index = Math.min(picked.index, Math.max(0, guide.routes.length - 1))
  const route = guide.routes[index]

  const send = (
    <PrimaryButton icon="smartphone" onClick={() => dispatch({ type: EVENTS.SEND_TO_PHONE_PRESSED })}>
      휴대폰으로 보내기
    </PrimaryButton>
  )

  return (
    <FlowFrame
      countdown
      showHome
      left={
        <div className="route-guide">
          <h1 className="route-guide-title">{SCREEN_TITLES[STATES.ROUTE_GUIDE]}</h1>
          {route ? (
            // key: 다른 경로를 고르면 타임라인을 새로 그리고 처음부터 다시 잰다
            <Timeline key={route.id ?? index} route={route} fallback={guide.fallback} appear={picked.byTap} />
          ) : (
            <p className="route-guide-empty">보여 드릴 경로가 없어요</p>
          )}
        </div>
      }
      rightTop={
        guide.routes.length > 1 && (
          <ul className="route-cards">
            {guide.routes.map((r, i) => (
              <li key={r.id ?? i}>
                <RouteCard route={r} selected={i === index} onSelect={() => setPicked({ index: i, byTap: true })} />
              </li>
            ))}
          </ul>
        )
      }
      actions={
        guide.single ? (
          <>
            <ul className="route-cards">
              <li>
                <RouteSummary route={route} />
              </li>
            </ul>
            {send}
          </>
        ) : (
          send
        )
      }
    />
  )
}
