// 개발자 패널. 화면 구석에 떠 있으면서 상태 머신 속을 보여 주고, 손으로 이벤트를 쏠 수 있게 한다.
//   - 현재 상태, failCount, 마지막 이벤트, config 시간값
//   - mock 시나리오 선택: api/mock/scenario.js 의 setScenario 를 부른다. reducer 상태가 아니라 개발 도구다.
//     바꾼 뒤 '처음부터' 를 누르면 STARTUP_CHECK 부터 다시 돌아 serverDown / sttDown / micDown 갈래를 바로 볼 수 있다.
//   - '처음부터' (DEV_RESET): 어느 상태에서든 initialState 로
//   - 현재 상태에서 가능한 이벤트 버튼: transitions[state] 에서 자동으로 뽑는다.
//     effect 가 아직 없는 Phase 2 에서 타이머·API 결과·판단 노드 이벤트를 대신 눌러 주는 용도다.
//     effect 가 생겨도 디버깅용으로 남겨 둔다.
//   - mock 마이크 입력 (LISTENING, mock 모드에서만): 말 대신 글을 넣는다. 화면 시안에 입력창이 없어서 화면에서 옮겨 왔다
//     (계획서 4-2절). 글이 바뀔 때마다 recorder.onInput 을 불러 예전처럼 무발화·무음 타이머가 돈다
//   - 장소 (mock 모드): 큰 띠에 보일 장소(지하철역 / 버스정류장 / 정보 없음 + 띠 시험 데이터)를 고르고 바로 다시 조회한다
//   - 위치: 조회 결과 한 줄과, GPS 대신 고정 위치를 쓰게 된 이유 (예전 첫 화면의 작은 글씨. 화면 시안에 없어서 옮겨 왔다)
// 워크플로우 코드가 아니므로 스타일은 이 파일 안 inline 으로만 둔다.

import { useState } from 'react'
import { useKiosk } from '../state/KioskContext.jsx'
import { DEV_EVENTS, EVENTS } from '../state/events.js'
import { transitions } from '../state/transitions.js'
import { config } from '../config.js'
import { SCENARIOS, getScenario, setScenario } from '../api/mock/scenario.js'
import { FAKE_LEVELS, getFakeLevel, setFakeLevel } from '../devices/mockRecorder.js'
import { STATES } from '../state/states.js'
import { USE_MOCK } from '../api/index.js'
import { recorder } from '../devices/recorder.js'
import { kioskError } from '../state/errorCodes.js'
import { POIS, MYEONGDONG } from '../api/mock/data/pois.js'
import { PLACES, PLACE_LABELS, BAND_CASES, getMockPlaceKey, setMockPlaceKey } from '../api/mock/data/places.js'
import { ROUTE_SUBWAY, ROUTE_BUS, ROUTE_LONG, ROUTE_CASES } from '../api/mock/data/routeCases.js'
import { ROUTES } from '../api/mock/data/routes.js'
import { REAL_V1_ROUTES, REAL_TRANSIT_ROUTES } from '../api/mock/data/realRouteSamples.js'
import { useLocation, useLocationRefresh } from '../state/LocationContext.jsx'

// 위치를 받지 못해 서버 설정의 고정 위치를 쓰게 된 이유 (예전 CurrentLocation 의 문구 그대로)
const FALLBACK_HINT = {
  PERMISSION_DENIED: '위치 사용이 꺼져 있어서 미리 정해 둔 곳으로 안내해요',
  LOW_ACCURACY: '위치가 정확하지 않아서 미리 정해 둔 곳으로 안내해요',
  OUT_OF_AREA: '안내할 수 있는 지역 밖이라 미리 정해 둔 곳으로 안내해요',
}
const DEFAULT_FALLBACK_HINT = '위치를 확인하지 못해서 미리 정해 둔 곳으로 안내해요'

function LocationInfo() {
  const { location, status } = useLocation()
  const refresh = useLocationRefresh()
  const [placeKey, setPlaceKeyView] = useState(getMockPlaceKey)
  const onPlaceChange = (e) => {
    setMockPlaceKey(e.target.value)
    setPlaceKeyView(e.target.value)
    refresh()
  }
  const hint = location && location.source !== 'GPS' && location.reason ? (FALLBACK_HINT[location.reason] ?? DEFAULT_FALLBACK_HINT) : null
  return (
    <div style={{ marginTop: 6 }}>
      <strong>location</strong> {status} {location?.text || '(이름 없음)'} {location?.place ? `[${location.place.type}]` : '[place 없음]'}
      {hint && <div>{hint}</div>}
      {USE_MOCK && (
        <div style={{ marginTop: 2 }}>
          <select value={placeKey} onChange={onPlaceChange} aria-label="mock 장소">
            {Object.keys(PLACES).map((key) => (
              <option key={key} value={key}>
                장소: {PLACE_LABELS[key]}
              </option>
            ))}
            {Object.keys(BAND_CASES).map((key) => (
              <option key={key} value={key}>
                장소(띠 시험): {key}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

const toSeconds = (ms) => (ms / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })

// LISTENING 에 들어갈 때마다 새로 그려져서(빈 글로 시작) 지난 입력이 남지 않는다.
// '다 말했어요'(화면 버튼)는 recorder.getText() 로 이 글을 읽어 SPEECH_END 에 싣는다
function MockSpeechInput() {
  const [text, setText] = useState('')
  const onChange = (e) => {
    setText(e.target.value)
    recorder.onInput(e.target.value) // 장치에 "지금 말하는 중" 을 알린다 (무발화 타이머 해제, 무음 타이머 리셋)
  }
  return (
    <div style={{ marginTop: 6 }}>
      <strong>mock 마이크</strong> 말 대신 글로 입력
      <input
        type="text"
        value={text}
        onChange={onChange}
        // 화면이 열리면 바로 타이핑할 수 있게 커서를 둔다
        autoFocus
        placeholder="예: 서울역 / 병원 / 웅얼 / 하와이 / 에러"
        aria-label="mock 마이크: 말 대신 글로 입력"
        style={{ display: 'block', width: '100%', marginTop: 2, font: 'inherit' }}
      />
      <div>
        입력 없이 {toSeconds(config.noSpeechMs)}초, 또는 입력을 멈추고 {toSeconds(config.silenceMs)}초 지나면 넘어감
      </div>
    </div>
  )
}

// mock 마이크의 가짜 음량 (LISTENING 음량 막대, 옮기기 계획 12단계). 녹음기 모듈 변수라 바로 다음 프레임부터 바뀐다
const FAKE_LEVEL_LABELS = {
  [FAKE_LEVELS.speak]: '켜기 (말하는 듯 오르내림)',
  [FAKE_LEVELS.quiet]: '조용함',
  [FAKE_LEVELS.loud]: '큰 소리',
  [FAKE_LEVELS.off]: '끄기 (잴 수 없음 → 멈춘 모양)',
}

function MockLevelSelect() {
  const [mode, setModeView] = useState(getFakeLevel)
  const onChange = (e) => {
    setFakeLevel(e.target.value)
    setModeView(e.target.value)
  }
  return (
    <div style={{ marginTop: 6 }}>
      <strong>가짜 음량</strong>{' '}
      <select value={mode} onChange={onChange} aria-label="가짜 음량">
        {Object.values(FAKE_LEVELS).map((m) => (
          <option key={m} value={m}>
            {FAKE_LEVEL_LABELS[m]}
          </option>
        ))}
      </select>
    </div>
  )
}

// 시나리오별 한 줄 설명. 어느 Phase 에서 효과가 나는지도 적어 둔다.
const SCENARIO_LABELS = {
  [SCENARIOS.normal]: 'normal — 모두 정상',
  [SCENARIOS.serverDown]: 'serverDown — 서버 불가 → CHECKING',
  [SCENARIOS.sttDown]: 'sttDown — STT 불가 → IDLE_REDUCED',
  [SCENARIOS.micDown]: 'micDown — 마이크 불가 → IDLE_REDUCED',
  [SCENARIOS.routeError]: 'routeError — 경로 조회 오류 → UNAVAILABLE',
  [SCENARIOS.noRoute]: 'noRoute — 경로 없음 → UNAVAILABLE (시연 흐름 3번)',
  [SCENARIOS.poisError]: 'poisError — 목적지 목록 오류 (화면 문구만, 전이 없음)',
  [SCENARIOS.longNames]: 'longNames — 목적지 목록을 긴 이름 12개로 (줄 바꿈 시험)',
  [SCENARIOS.qrError]: 'qrError — QR 생성 오류 (화면 문구만, 전이 없음)',
}

// payload 가 필요한 이벤트에 끼워 넣을 가짜 값. 화면이 뭔가 표시할 수 있을 정도만.
const FAKE_POI = { id: 'poi-seoul-station', name: '서울역', category: '지하철역' }
const FAKE_CANDIDATES = [
  { id: 'poi-hospital-a', name: '동국대병원', category: '병원' },
  { id: 'poi-hospital-b', name: '서울병원', category: '병원' },
]
// ROUTE_FOUND 의 기본 경로: mock /route 와 같은 지하철역 묶음 A·B·C (디자인 문서 9-2절 모양)
const FAKE_ROUTES = ROUTES
const DEV_PAYLOADS = {
  [EVENTS.HEALTH_OK]: { health: { server: true, mic: true, stt: true } },
  [EVENTS.HEALTH_SERVER_DOWN]: { health: { server: false, mic: true, stt: true } },
  [EVENTS.MIC_OR_STT_UNAVAILABLE]: { health: { server: true, mic: false, stt: true } },
  [EVENTS.SPEECH_END]: { text: '서울역' },
  [EVENTS.RESOLVE_NEED_CONFIRM]: { resolve: { status: 'OK', needConfirm: true, candidates: FAKE_CANDIDATES } },
  [EVENTS.RESOLVE_CONFIRMED]: { resolve: { status: 'OK', needConfirm: false, poi: FAKE_POI } },
  [EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR]: { error: kioskError('OUT_OF_SCOPE', '이 키오스크에서 안내할 수 없는 곳이에요') },
  [EVENTS.DESTINATION_CONFIRMED]: { poi: FAKE_POI },
  [EVENTS.POI_SELECTED]: { poi: FAKE_POI },
  [EVENTS.ROUTE_FOUND]: { routes: FAKE_ROUTES },
  [EVENTS.ROUTE_FAILED]: { error: kioskError('NO_ROUTE', '가는 길을 찾을 수 없어요') },
}

// 오류로 가는 이벤트(ROUTE_FAILED, RESOLVE_OUT_OF_SCOPE_OR_ERROR)에 실을 가짜 error. 패널의 '오류 이유' 로 고른다.
// ''(기본)이면 위 DEV_PAYLOADS 의 값. 문구는 서버·핸들러가 실제로 주는 문장 (디자인 문서 12-3절 표, 시안 unavailable-final.html REASONS)
const FAKE_ERRORS = {
  noroute: kioskError('NO_ROUTE', '가는 길을 찾을 수 없어요'),
  close: kioskError('TOO_CLOSE', '가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.'),
  scope: kioskError('OUT_OF_SCOPE', '이 키오스크에서 안내할 수 없는 곳이에요'),
  upstream: kioskError('UPSTREAM', '지금은 길 안내를 받아올 수 없어요. 잠시 후 다시 해 주세요.'),
  generic: kioskError('UNKNOWN', 'SERVER_TIMEOUT'),
  nopoi: kioskError('NO_POI', '목적지가 정해지지 않았어요'),
  long: kioskError('UNKNOWN', '말씀이 조금 길었어요. 짧게 한 번 더 말씀해 주세요.'),
}
// RESOLVE_NEED_CONFIRM 에 실을 후보 묶음. 패널의 '후보 묶음' 으로 고른다 (CONFIRMING 의 경우를 보려고, 시안 confirming-final.html).
// ''(기본)이면 위 FAKE_CANDIDATES. 이벤트는 그대로이고 payload 만 다르다
const hospitals = POIS.filter((p) => p.category === '병원')
const FAKE_CANDIDATE_SETS = {
  hospital: hospitals,
  myeongdong: [...MYEONGDONG],
  one: hospitals.slice(0, 1),
  long: [
    { id: 'poi-long-a', name: '서울특별시 동부병원 응급의료센터 별관', category: '종합병원' },
    { id: 'poi-long-b', name: '동국대학교 일산불교병원', category: '대학병원' },
    hospitals[2],
  ],
}

// RESOLVE_NEED_CONFIRM 에 함께 실을 서버 질문(confirmText). 패널의 '질문 문구' 로 고른다 (디자인 문서 11-2절 긴 문구 규칙 시험).
// ''(기본)이면 질문 없음 → 화면은 "가시려는 곳을 하나 골라 주세요". len40·len80 은 일부러 40·80자로 맞춘 길이
const FAKE_CONFIRM_TEXTS = {
  short: '종로 몇 가로 가세요?',
  len40: '동국대병원, 서울병원, 일산불교병원 세 곳 중에 어디로 가시려고 하세요?',
  len80: '말씀하신 곳과 이름이 비슷한 곳이 여러 군데 있어요. 동국대병원, 서울병원, 일산불교병원 가운데 가시려는 곳을 아래 목록에서 하나만 골라 주세요',
}

// ROUTE_FOUND 에 실을 경로 묶음. 패널의 '경로 묶음' 으로 고른다 (ROUTE_GUIDE 의 경우를 보려고, 시안 route-guide-final.html).
// ''(기본)이면 위 FAKE_ROUTES(= ?set=subway). bus·long 은 시안의 기본·?set=long, 나머지는 ?case= (route-cases.js),
// real-v1·real-transit 은 real 서버 응답 두 모양을 실제 변환 코드로 바꾼 것. 이벤트는 그대로이고 payload 만 다르다
const FAKE_ROUTE_SETS = {
  subway: ROUTE_SUBWAY,
  bus: ROUTE_BUS,
  long: [ROUTE_LONG, ROUTE_BUS[1], ROUTE_BUS[2]],
  ...ROUTE_CASES,
  'real-v1': REAL_V1_ROUTES,
  'real-transit': REAL_TRANSIT_ROUTES,
}

const ERROR_EVENTS = new Set([EVENTS.ROUTE_FAILED, EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR])

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
  const [devError, setDevError] = useState('') // FAKE_ERRORS 의 키. '' 이면 이벤트별 기본값
  const [devCandidates, setDevCandidates] = useState('') // FAKE_CANDIDATE_SETS 의 키
  const [devRoutes, setDevRoutes] = useState('') // FAKE_ROUTE_SETS 의 키
  const [devConfirmText, setDevConfirmText] = useState('') // FAKE_CONFIRM_TEXTS 의 키

  const payloadOf = (event) => {
    if (devError && ERROR_EVENTS.has(event)) return { error: FAKE_ERRORS[devError] }
    if ((devCandidates || devConfirmText) && event === EVENTS.RESOLVE_NEED_CONFIRM) {
      const candidates = devCandidates ? FAKE_CANDIDATE_SETS[devCandidates] : FAKE_CANDIDATES
      const confirmText = devConfirmText ? FAKE_CONFIRM_TEXTS[devConfirmText] : null
      return { resolve: { status: 'OK', needConfirm: true, candidates, confirmText } }
    }
    if (devRoutes && event === EVENTS.ROUTE_FOUND) return { routes: FAKE_ROUTE_SETS[devRoutes] }
    return DEV_PAYLOADS[event] ?? {}
  }

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
        <strong>transcript</strong> {state.transcript === '' ? '(빈 문자열)' : JSON.stringify(state.transcript)}
      </div>
      <div>
        <strong>selectedPoi</strong>{' '}
        {state.selectedPoi ? `${state.selectedPoi.name} (${state.selectedPoi.id})` : 'null'}
      </div>
      <div>
        <strong>resolve.status</strong> {state.resolve?.status ?? 'null'}
      </div>
      <div>
        <strong>error</strong> {state.error ? JSON.stringify(state.error) : 'null'}
      </div>
      <div>
        <strong>config(ms)</strong>{' '}
        {Object.entries(config)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')}
      </div>

      <LocationInfo />

      {/* STT 서버 연동 여부와 설정 페이지로 가는 길 (settings/SettingsPage.jsx) */}
      <div style={{ marginTop: 6 }}>
        <strong>STT 서버 연동</strong> {USE_MOCK ? '꺼짐 (연습용 데이터)' : '켜짐'} · <a href="#settings">설정</a>
      </div>

      {USE_MOCK && state.state === STATES.LISTENING && <MockSpeechInput />}
      {USE_MOCK && <MockLevelSelect />}

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

      <div style={{ marginTop: 2 }}>
        <select value={devError} onChange={(e) => setDevError(e.target.value)} aria-label='오류 이유'>
          <option value=''>오류 이유: 이벤트 기본값</option>
          {Object.entries(FAKE_ERRORS).map(([key, err]) => (
            <option key={key} value={key}>
              오류 이유: {key} ({err.code})
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 2 }}>
        <select value={devCandidates} onChange={(e) => setDevCandidates(e.target.value)} aria-label="후보 묶음">
          <option value="">후보 묶음: 기본 (2개)</option>
          {Object.entries(FAKE_CANDIDATE_SETS).map(([key, list]) => (
            <option key={key} value={key}>
              후보 묶음: {key} ({list.length}개)
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 2 }}>
        <select value={devConfirmText} onChange={(e) => setDevConfirmText(e.target.value)} aria-label="질문 문구">
          <option value="">질문 문구: 없음</option>
          {Object.entries(FAKE_CONFIRM_TEXTS).map(([key, text]) => (
            <option key={key} value={key}>
              질문 문구: {key} ({[...text].length}자)
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 2 }}>
        <select value={devRoutes} onChange={(e) => setDevRoutes(e.target.value)} aria-label="경로 묶음">
          <option value="">경로 묶음: 기본 (지하철역 A·B·C)</option>
          {Object.entries(FAKE_ROUTE_SETS).map(([key, list]) => (
            <option key={key} value={key}>
              경로 묶음: {key} ({list.length}개)
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 6 }}>
        <strong>가능한 이벤트</strong> ({Object.keys(available).length})
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          {Object.entries(available).map(([event, next]) => (
            <button
              key={event}
              type="button"
              title={`${state.state} --(${event})--> ${next}`}
              onClick={() => dispatch({ type: event, ...payloadOf(event) })}
            >
              {event} → {next}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
