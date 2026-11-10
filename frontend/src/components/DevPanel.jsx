// 개발자 패널. 화면 구석에 떠 있으면서 상태 머신 속을 보여 주고, 손으로 이벤트를 쏠 수 있게 한다.
//   - 현재 상태, failCount, 마지막 이벤트, config 시간값
//   - mock 시나리오 선택: api/mock/scenario.js 의 setScenario 를 부른다. reducer 상태가 아니라 개발 도구다.
//     바꾼 뒤 '처음부터' 를 누르면 STARTUP_CHECK 부터 다시 돌아 serverDown / sttDown / micDown 갈래를 바로 볼 수 있다.
//   - '처음부터' (DEV_RESET): 어느 상태에서든 initialState 로
//   - 현재 상태에서 가능한 이벤트 버튼: transitions[state] 에서 자동으로 뽑는다.
//     effect 가 아직 없는 Phase 2 에서 타이머·API 결과·판단 노드 이벤트를 대신 눌러 주는 용도다.
//     effect 가 생겨도 디버깅용으로 남겨 둔다.
// 워크플로우 코드가 아니므로 스타일은 이 파일 안 inline 으로만 둔다.

import { useState } from 'react'
import { useKiosk } from '../state/KioskContext.jsx'
import { DEV_EVENTS, EVENTS } from '../state/events.js'
import { transitions } from '../state/transitions.js'
import { config } from '../config.js'
import { SCENARIOS, getScenario, setScenario } from '../api/mock/scenario.js'

// 시나리오별 한 줄 설명. 어느 Phase 에서 효과가 나는지도 적어 둔다.
const SCENARIO_LABELS = {
  [SCENARIOS.normal]: 'normal — 모두 정상',
  [SCENARIOS.serverDown]: 'serverDown — 서버 불가 → CHECKING',
  [SCENARIOS.sttDown]: 'sttDown — STT 불가 → IDLE_REDUCED',
  [SCENARIOS.micDown]: 'micDown — 마이크 불가 → IDLE_REDUCED',
  [SCENARIOS.routeError]: 'routeError — 경로 조회 오류 (Phase 5)',
  [SCENARIOS.poisError]: 'poisError — 목적지 목록 오류 (Phase 5)',
  [SCENARIOS.qrError]: 'qrError — QR 생성 오류 (Phase 5)',
}

// payload 가 필요한 이벤트에 끼워 넣을 가짜 값. 화면이 뭔가 표시할 수 있을 정도만.
const FAKE_POI = { id: 'poi-seoul-station', name: '서울역', category: '지하철역' }
const FAKE_CANDIDATES = [
  { id: 'poi-hospital-a', name: '동국대병원', category: '병원' },
  { id: 'poi-hospital-b', name: '서울병원', category: '병원' },
]
const FAKE_ROUTES = [
  { id: 'route-1', summary: '지하철 3호선 → 4호선, 25분' },
  { id: 'route-2', summary: '버스 100번, 32분' },
  { id: 'route-3', summary: '지하철 3호선 → 버스 200번, 35분' },
]
const DEV_PAYLOADS = {
  [EVENTS.HEALTH_OK]: { health: { server: true, mic: true, stt: true } },
  [EVENTS.HEALTH_SERVER_DOWN]: { health: { server: false, mic: true, stt: true } },
  [EVENTS.MIC_OR_STT_UNAVAILABLE]: { health: { server: true, mic: false, stt: true } },
  [EVENTS.SPEECH_END]: { text: '서울역' },
  [EVENTS.RESOLVE_NEED_CONFIRM]: { resolve: { status: 'OK', needConfirm: true, candidates: FAKE_CANDIDATES } },
  [EVENTS.RESOLVE_CONFIRMED]: { resolve: { status: 'OK', needConfirm: false, poi: FAKE_POI } },
  [EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR]: { error: '범위 밖 (DevPanel)' },
  [EVENTS.DESTINATION_CONFIRMED]: { poi: FAKE_POI },
  [EVENTS.POI_SELECTED]: { poi: FAKE_POI },
  [EVENTS.ROUTE_FOUND]: { routes: FAKE_ROUTES },
  [EVENTS.ROUTE_FAILED]: { error: '경로 없음 (DevPanel)' },
}

const panelStyle = {
  position: 'fixed',
  right: 8,
  bottom: 8,
  maxWidth: 360,
  padding: 8,
  border: '1px solid #999',
  background: '#f5f5f5',
  color: '#222',
  fontSize: 12,
  fontFamily: 'ui-monospace, Consolas, monospace',
  lineHeight: 1.5,
}

export default function DevPanel() {
  const { state, dispatch } = useKiosk()
  const available = transitions[state.state] ?? {}

  // 현재 시나리오를 화면에 보여 주기 위한 복사본. 진짜 값은 scenario.js 모듈 변수에 있다.
  // (모듈 변수가 바뀌어도 React 는 모르므로, 표시 갱신용으로만 state 를 하나 둔다)
  const [scenario, setScenarioView] = useState(getScenario)

  const onScenarioChange = (e) => {
    setScenario(e.target.value) // mock API·recorder 가 읽는 진짜 값
    setScenarioView(e.target.value) // 패널 표시
  }

  return (
    <aside style={panelStyle} aria-label="개발자 패널">
      <div>
        <strong>state</strong> {state.state}
      </div>
      <div>
        <strong>failCount</strong> {state.failCount}
      </div>
      <div>
        <strong>lastEvent</strong> {state.lastEvent ?? '-'}
      </div>
      <div>
        <strong>config(ms)</strong>{' '}
        {Object.entries(config)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')}
      </div>

      <div style={{ marginTop: 6 }}>
        <strong>scenario</strong> {scenario}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
        <select value={scenario} onChange={onScenarioChange} aria-label="mock 시나리오">
          {Object.values(SCENARIOS).map((name) => (
            <option key={name} value={name}>
              {SCENARIO_LABELS[name] ?? name}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => dispatch({ type: DEV_EVENTS.DEV_RESET })}>
          처음부터 (DEV_RESET)
        </button>
      </div>

      <div style={{ marginTop: 6 }}>
        <strong>가능한 이벤트</strong> ({Object.keys(available).length})
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          {Object.entries(available).map(([event, next]) => (
            <button
              key={event}
              type="button"
              title={`${state.state} --(${event})--> ${next}`}
              onClick={() => dispatch({ type: event, ...(DEV_PAYLOADS[event] ?? {}) })}
            >
              {event} → {next}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
