// 설정 페이지. 주소 끝에 #settings 를 붙이면 키오스크 화면 대신 이 페이지가 열린다 (main.jsx).
// 이용자가 쓰는 화면이 아니라 설치·개발하는 사람이 쓰는 화면이라, 키오스크 무대(1920×1080) 밖에서 보통 웹 페이지 크기로 그린다.
//
// 탭
//   서버 연동  STT 서버(음성 인식·목적지 해석·현재 위치)와 연동할지: 자동 / 켜기 / 끄기 (settings/integration.js)
//              학습한 음성 모델이 올라간 서버가 없는 PC 에서는 끄거나 자동으로 두면 연습용 데이터로 돈다
//   위치       키오스크가 놓인 곳: 현재 위치로 찾기 / 역 번호·정류장 번호·이름으로 직접 지정 (LocationTab.jsx, settings/kioskPlace.js)
//   음성 안내  화면의 안내를 소리로 읽어 줄지, 빠르기, 목소리 (SpeechTab.jsx, settings/speechSettings.js)
//   경로       카카오 길찾기가 실패할 때 ODsay 로 대신 찾을지, 백업 상태와 연결 확인 (RouteTab.jsx, settings/routeBackup.js)
// 탭을 더할 때는 TABS 에 한 줄을 넣고 그 탭의 컴포넌트를 만든다.
//
// 저장하면 선택을 브라우저에 적고 키오스크 화면을 새로 연다. 연동 여부는 화면을 열 때 한 번 정해지기 때문이다.

import { useEffect, useState } from 'react'
import { CHOICES, DEMO_BUILD, MOCK_BUILD, REASON_TEXT, decide, probeStt, readChoice, statusText, writeChoice } from './integration.js'
import LocationTab from './LocationTab.jsx'
import SpeechTab from './SpeechTab.jsx'
import RouteTab from './RouteTab.jsx'
import './SettingsPage.css'

const CHOICE_TEXT = Object.freeze({
  auto: { label: '자동', help: '화면을 열 때 서버가 응답하면 켜고, 응답하지 않으면 끕니다. 처음 값입니다.' },
  on: { label: '켜기', help: '늘 서버를 씁니다. 서버가 없으면 키오스크에 "점검 중" 화면이 나오고 다시 연결을 시도합니다.' },
  off: { label: '끄기', help: '서버를 쓰지 않습니다. 연습용 데이터와 가짜 마이크로 화면만 확인할 수 있습니다.' },
})

function IntegrationTab({ storage, probe, onDone }) {
  const [choice, setChoice] = useState(() => readChoice(storage))
  const [status, setStatus] = useState(null) // null = 확인 중
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    probe().then((result) => {
      if (alive) setStatus(result)
    })
    return () => {
      alive = false
    }
  }, [probe])

  const result = decide({ demo: DEMO_BUILD, mockBuild: MOCK_BUILD, choice, reachable: Boolean(status?.reachable) })
  const save = () => {
    if (writeChoice(choice, storage)) onDone()
    else setFailed(true)
  }

  return (
    <section className="settings-section" aria-labelledby="settings-stt-title">
      <h2 id="settings-stt-title">음성 인식 서버 (STT)</h2>
      <p className="settings-note">
        말을 글로 바꾸고 목적지와 지금 계신 곳을 찾는 서버입니다. 학습한 음성 모델은 이 서버에 올라가 있고, GPU 와 모델 파일이 있는 PC
        에서만 띄울 수 있습니다.
      </p>

      <dl className="settings-status">
        <dt>서버 상태</dt>
        <dd className={status && !status.reachable ? 'is-off' : undefined}>{statusText(status)}</dd>
        <dt>띄운 방식</dt>
        <dd>{DEMO_BUILD ? '시연 모드' : MOCK_BUILD ? '연습 모드 (VITE_USE_MOCK=true)' : '실제 모드'}</dd>
      </dl>

      <fieldset className="settings-choices" disabled={DEMO_BUILD}>
        <legend>연동</legend>
        {CHOICES.map((value) => (
          <label key={value} className="settings-choice">
            <input type="radio" name="stt-integration" value={value} checked={choice === value} onChange={() => setChoice(value)} />
            <span>
              <strong>{CHOICE_TEXT[value].label}</strong>
              <small>{CHOICE_TEXT[value].help}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="settings-result" role="status">
        이 설정으로 화면을 열면 연동이 <strong>{result.linked ? '켜집니다' : '꺼집니다'}</strong>
        {status || choice !== 'auto' || MOCK_BUILD || DEMO_BUILD ? ` (${REASON_TEXT[result.reason]})` : ' (서버 확인 중)'}
      </p>
      {failed && (
        <p className="settings-error" role="alert">
          설정을 저장하지 못했습니다. 브라우저가 저장소를 막고 있는지 확인해 주세요.
        </p>
      )}

      <div className="settings-actions">
        <button type="button" className="settings-button is-primary" onClick={save} disabled={DEMO_BUILD}>
          저장하고 키오스크 화면 열기
        </button>
        <button type="button" className="settings-button" onClick={onDone}>
          저장하지 않고 돌아가기
        </button>
      </div>
    </section>
  )
}

const TABS = Object.freeze([
  { id: 'integration', label: '서버 연동', Component: IntegrationTab },
  { id: 'location', label: '위치', Component: LocationTab },
  { id: 'speech', label: '음성 안내', Component: SpeechTab },
  { id: 'route', label: '경로', Component: RouteTab },
])

/** 설정을 닫고 키오스크 화면을 새로 연다 (연동 여부를 다시 정하도록). 주소에서 #settings 를 떼고 새로 연다 */
function leaveSettings() {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  window.location.reload()
}

export default function SettingsPage({ storage, probe = probeStt, onDone = leaveSettings }) {
  const [tabId, setTabId] = useState(TABS[0].id)
  const { Component } = TABS.find((t) => t.id === tabId) ?? TABS[0]

  return (
    <main className="settings-page">
      <h1>설정</h1>
      <div className="settings-tabs" role="tablist" aria-label="설정 탭">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === tabId} className="settings-tab" onClick={() => setTabId(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        <Component storage={storage} probe={probe} onDone={onDone} />
      </div>
    </main>
  )
}
