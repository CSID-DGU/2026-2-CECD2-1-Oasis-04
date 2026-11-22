// QR_HANDOFF: 6 QR 전달 (계획서 3절, 디자인 문서 12-5절, 확정 시안 qr-handoff-final.html).
// 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당이고, 남은 15초부터 띠에 알림을 보인다 (FlowFrame 의 countdown, 11-4절).
//
// 보내는 경로: ROUTE_GUIDE 에서 '휴대폰으로 보내기'를 누를 때 고른 경로 = state.selectedRouteId (11단계).
//   그 id 가 화면 경로 목록(toRouteGuide(state.routes).routes)에 없거나 비어 있으면 첫 경로(ROUTE_GUIDE 가 처음 보이는 경로).
// 화면이 열리면 그 경로의 id 로 api.createQr(routeId) 를 불러 받은 주소로 QR 그림을 만든다 (QrBox, 인터넷 없이).
//   화면 컴포넌트가 API 를 직접 부르는 것은 getPois / createQr 둘만 허용된다 (계획서 2-3절 예외).
//   만들든 실패하든 상태는 QR_HANDOFF 그대로이고, 실패해도 이벤트를 dispatch 하지 않고 QR 자리에 글만 보인다 (계획서 4절).
//   status: 'loading' → '만드는 중이에요' / 'error' → 'QR을 만들지 못했어요' 또는 '보낼 경로가 없어요' / 'ready' → QR
//   real 모드에서 경로 응답에 휴대폰 주소(landing_url)가 없으면 createQr 가 실패한다 → 'QR을 만들지 못했어요' (12-5절의 오류 상태,
//   docs/team-requests.md #7·#15)
//
// 왼쪽 칸: 제목 → QR 상자 + 단계 세 줄. 오른쪽 칸: 보내는 경로의 요약 판(RouteSummary, 9-1 R3 와 같은 모양) + '처음으로'.
// 주 버튼 없음 (디자인 문서 2절의 의도한 예외). 버튼은 '처음으로'(GO_HOME) 하나이고 FlowFrame 의 showHome 이 그린다.
// 음성 안내: QR 이 만들어지면 단계 세 줄을, 만들지 못하면 그 문구를 읽는다 (view/speechText.js qrSpeech, 2026-11-22)

import { useEffect, useMemo, useState } from 'react'
import FlowFrame from '../components/FlowFrame.jsx'
import QrBox from '../components/QrBox.jsx'
import RouteSummary from '../components/RouteSummary.jsx'
import StepNumber from '../components/StepNumber.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { api } from '../api/index.js'
import { toRouteGuide } from '../view/routeView.js'
import { SCREEN_TITLES } from './titles.js'
import { QR_MESSAGES, QR_STEPS } from './qrHandoffText.js'
import { useSay } from '../effects/useSay.js'
import { qrSpeech } from '../view/speechText.js'
import './QrHandoffScreen.css'

export default function QrHandoffScreen() {
  const { state } = useKiosk()
  const route = useMemo(() => {
    const { routes } = toRouteGuide(state.routes)
    return routes.find((r) => r.id != null && r.id === state.selectedRouteId) ?? routes[0] ?? null
  }, [state.routes, state.selectedRouteId])
  const routeId = route?.id ?? null

  // 경로가 없으면 부를 수 없으므로 처음부터 error 로 시작한다 (effect 안에서 동기 setState 를 피하려고 초기값에서 정한다)
  const [load, setLoad] = useState(() =>
    routeId ? { status: 'loading', url: null } : { status: 'error', url: null, message: QR_MESSAGES.noRoute },
  )

  useEffect(() => {
    if (!routeId) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const { url } = await api.createQr(routeId)
        if (cancelled) return
        if (!url) throw new Error('QR_ERROR')
        setLoad({ status: 'ready', url })
      } catch (e) {
        if (cancelled) return
        console.warn('[qrHandoff] createQr 실패:', e?.message)
        setLoad({ status: 'error', url: null, message: QR_MESSAGES.createError })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [routeId]) // 화면이 열릴 때 한 번. QR_HANDOFF 에 머무는 동안 경로는 바뀌지 않는다

  const message = load.status === 'loading' ? QR_MESSAGES.loading : load.message
  useSay(qrSpeech(load.status, { steps: QR_STEPS, message }))

  return (
    <FlowFrame
      countdown
      showHome
      left={
        <div className="qr-handoff">
          <h1 className="qr-handoff-title">{SCREEN_TITLES[STATES.QR_HANDOFF]}</h1>
          <div className="qr-handoff-row">
            <QrBox status={load.status} url={load.url} message={message} />
            <div className="qr-handoff-side">
              <ol className="qr-handoff-steps">
                {QR_STEPS.map((text, i) => (
                  <li key={text}>
                    <StepNumber n={i + 1} />
                    <span>{text}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      }
      actions={route && <RouteSummary route={route} />}
    />
  )
}
