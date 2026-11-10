// MANUAL_SELECT: 8 손으로 고르기 (계획서 3절). 목적지 버튼 / 말로 하기 / 처음으로.
// 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당 (Phase 5 4번).
//
// 목적지 목록은 화면이 열릴 때 api.getPois() 로 직접 불러온다.
// 화면 컴포넌트가 API 를 직접 부르는 것은 getPois / createQr 둘만 허용된다 (계획서 2-3절 예외).
// 이유: 이 조회는 상태 전이를 일으키지 않는 "표시용" 이라서, 실패해도 이벤트를 dispatch 하지 않고
// 화면에 오류 문구만 보여 준다 (계획서 4절). 전이가 없으니 reducer·transitions 에도 아무 흔적이 없다.
//
// 불러오기 상태는 이 화면만 쓰는 임시값이라 reducer 가 아니라 로컬 state(useState) 에 둔다.
//   status: 'loading' → '불러오는 중…'
//           'error'   → '목록을 불러올 수 없어요'
//           'ready'   → pois 를 큰 버튼으로
// StrictMode 규칙: cancelled 플래그. 화면이 사라진 뒤(또는 StrictMode 1차 실행의 cleanup 뒤) 도착한 응답은 무시한다.
//
// 버튼: 목적지 → POI_SELECTED({ poi })  (reducer 가 poi 객체 전체를 selectedPoi 에 저장. ROUTING 이 .id, 화면이 .name 을 쓴다)
//       '말로 하기' → SWITCH_TO_VOICE (reducer 가 failCount 를 0 으로)
//       '처음으로' → GO_HOME (ScreenFrame 의 showHome 이 그린다)

import { useEffect, useState } from 'react'
import ScreenFrame from '../components/ScreenFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { api } from '../api/index.js'

const LOAD_ERROR_MESSAGE = '목록을 불러올 수 없어요'

export default function ManualSelectScreen() {
  const { dispatch } = useKiosk()
  // 불러오기 진행 상태와 결과. 한 객체로 묶어 두면 "status 는 ready 인데 pois 는 비어 있는" 어긋난 순간이 생기지 않는다.
  const [load, setLoad] = useState({ status: 'loading', pois: [] })

  useEffect(() => {
    let cancelled = false
    // 초기값이 이미 'loading' 이므로 여기서 setLoad 를 다시 부르지 않는다.
    // (effect 본문에서 동기 setState 를 하면 불필요한 재렌더가 생겨 ESLint 가 막는다)

    ;(async () => {
      try {
        const pois = await api.getPois()
        if (cancelled) return
        setLoad({ status: 'ready', pois })
      } catch (e) {
        if (cancelled) return
        console.warn('[manualSelect] getPois 실패:', e?.message)
        // 전이 없음: dispatch 하지 않는다. 사용자는 '말로 하기' 나 '처음으로' 로 나갈 수 있다.
        setLoad({ status: 'error', pois: [] })
      }
    })()

    return () => {
      cancelled = true
    }
  }, []) // 화면이 처음 열릴 때 한 번. 상태가 MANUAL_SELECT 로 바뀔 때마다 새로 마운트되므로 매번 다시 불러온다.

  return (
    <ScreenFrame
      title={STATES.MANUAL_SELECT}
      showHome
      actions={
        <button type="button" onClick={() => dispatch({ type: EVENTS.SWITCH_TO_VOICE })}>
          말로 하기
        </button>
      }
    >
      <p>가실 곳을 골라 주세요</p>

      {load.status === 'loading' && <p>불러오는 중…</p>}
      {load.status === 'error' && <p>{LOAD_ERROR_MESSAGE}</p>}

      {load.status === 'ready' && (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {load.pois.map((poi) => (
            // key: 서버가 준 고유 id. 큰 버튼 스타일은 Phase 6 global.css 에서 다듬는다.
            <li key={poi.id}>
              <button type="button" onClick={() => dispatch({ type: EVENTS.POI_SELECTED, poi })}>
                {poi.name}
                {poi.category && <small> ({poi.category})</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </ScreenFrame>
  )
}
