// QR_HANDOFF: 6 QR 전달 (계획서 3절). 처음으로만. 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당 (Phase 5 4번).
//
// 화면이 열리면 1순위 경로(state.routes[0]) 의 id 로 api.createQr(routeId) 를 불러 받은 URL 을 텍스트로 크게 보여 준다.
// QR 이미지 라이브러리는 아직 쓰지 않는다 (계획서 6절 2번: QR 생성 주체 미정 → 보류). 결정되면 URL 을 이미지로 바꾸기만 하면 된다.
//
// 화면 컴포넌트가 API 를 직접 부르는 것은 getPois / createQr 둘만 허용된다 (계획서 2-3절 예외).
// QR 이 만들어지든 실패하든 상태는 QR_HANDOFF 그대로이고, 실패해도 이벤트를 dispatch 하지 않고 오류 문구만 보여 준다 (계획서 4절).
// 불러오기 패턴은 ManualSelectScreen 과 같다: 로컬 state { status, url } + cancelled 플래그.
//   status: 'loading' → '만드는 중…'
//           'error'   → 'QR 을 만들지 못했어요'
//           'ready'   → URL 텍스트
// 1순위 경로가 없으면(정상 흐름에선 오지 않는다. DevPanel 로 routes 없이 들어온 경우) API 를 부르지 않고 바로 error 로 둔다.
// 버튼은 '처음으로'(GO_HOME) 하나뿐이며 ScreenFrame 의 showHome 이 그린다.

import { useEffect, useState } from 'react'
import ScreenFrame from '../components/ScreenFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { api } from '../api/index.js'

const GUIDE_MESSAGE = '휴대폰 카메라로 QR을 찍으면 길 안내를 볼 수 있어요'
const CREATE_ERROR_MESSAGE = 'QR을 만들지 못했어요'
const NO_ROUTE_MESSAGE = '보낼 경로가 없어요'

export default function QrHandoffScreen() {
  const { state } = useKiosk()
  // 1순위 경로 id. 응답 규약(1순위가 첫 번째, 계획서 7절)대로 배열의 첫 항목을 쓴다.
  const routeId = state.routes[0]?.id

  // routeId 가 없으면 부를 수 없으므로 처음부터 error 로 시작한다 (effect 안에서 동기 setState 를 피하기 위해 초기값에서 결정).
  const [load, setLoad] = useState(() =>
    routeId ? { status: 'loading', url: null, message: null } : { status: 'error', url: null, message: NO_ROUTE_MESSAGE },
  )

  useEffect(() => {
    if (!routeId) return undefined
    let cancelled = false

    ;(async () => {
      try {
        const { url } = await api.createQr(routeId)
        if (cancelled) return
        setLoad({ status: 'ready', url, message: null })
      } catch (e) {
        if (cancelled) return
        console.warn('[qrHandoff] createQr 실패:', e?.message)
        // 전이 없음: dispatch 하지 않는다. 사용자는 '처음으로' 로 나갈 수 있다.
        setLoad({ status: 'error', url: null, message: CREATE_ERROR_MESSAGE })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [routeId]) // 화면이 열릴 때 한 번. routeId 는 QR_HANDOFF 에 머무는 동안 바뀌지 않는다.

  return (
    <ScreenFrame title={STATES.QR_HANDOFF} showHome>
      <p>{GUIDE_MESSAGE}</p>
      <p style={{ fontSize: '0.8em', opacity: 0.7 }}>(지금은 QR 대신 주소 글자로 보여 드려요)</p>

      {load.status === 'loading' && <p>만드는 중…</p>}
      {load.status === 'error' && <p>{load.message}</p>}
      {load.status === 'ready' && (
        // QR 자리. 이미지 라이브러리 도입 후 이 블록만 <img> 로 바꾸면 된다.
        <p style={{ fontSize: '1.6em', fontWeight: 'bold', wordBreak: 'break-all' }}>{load.url}</p>
      )}
    </ScreenFrame>
  )
}
