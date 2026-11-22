// 설정 페이지의 '경로' 탭. 카카오 길찾기가 실패할 때 ODsay 로 대신 찾을지 정하고, 두 곳의 상태를 본다 (settings/routeBackup.js).
//
// 경로는 경로 서버(server/app.py)가 카카오 길찾기로 찾고, 실패하면 같은 서버가 ODsay 로 한 번 더 찾는다.
// 키는 경로 서버의 환경변수에만 둔다. 이 화면은 키가 있는지와 오늘 몇 번 썼는지만 보여 준다 (GET /routes/status).
// '연결 확인' 은 그 제공자로만 한 번 찾아 보고, 끝나면 남은 횟수를 같이 보여 준다. 누를 때마다 1회를 쓴다.
// 남은 횟수는 경로 서버가 켜진 뒤 센 횟수로 계산한 값이다 (카카오맵과 ODsay 는 남은 횟수를 알려 주지 않는다).

import { Fragment, useEffect, useState } from 'react'
import {
  BACKUP_MODES,
  PROVIDERS,
  leftOf,
  probeRoutes,
  providerOff,
  providerStatusText,
  readRouteBackup,
  testProvider,
  writeRouteBackup,
} from './routeBackup.js'

const MODE_TEXT = Object.freeze({
  auto: { label: '카카오 먼저, 실패하면 ODsay', help: '평소에는 카카오 길찾기를 쓰고, 그쪽이 실패할 때만 ODsay 로 한 번 더 찾습니다. 처음 값입니다.' },
  only: { label: 'ODsay 로만 찾기', help: '백업이 잘 되는지 볼 때만 씁니다. 하루 30회를 금방 쓰니 확인이 끝나면 되돌려 주세요.' },
  off: { label: '백업 쓰지 않기', help: '카카오 길찾기가 실패하면 바로 "지금은 길 안내를 받아올 수 없어요" 를 보입니다.' },
})

const PROVIDER_IDS = Object.freeze(['kakao', 'odsay'])

export default function RouteTab({ storage, onDone, probeRoute = probeRoutes, test = testProvider }) {
  const [mode, setMode] = useState(() => readRouteBackup(storage))
  const [status, setStatus] = useState(null) // null = 확인 중
  const [checked, setChecked] = useState({}) // 제공자 → '연결 확인' 의 결과 문장
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    probeRoute().then((result) => {
      if (alive) setStatus(result)
    })
    return () => {
      alive = false
    }
  }, [probeRoute])

  const runTest = async (provider) => {
    setChecked((c) => ({ ...c, [provider]: '확인하는 중입니다' }))
    const text = await test(provider)
    const next = await probeRoute() // 쓴 횟수가 바뀌었다
    setStatus(next)
    const left = leftOf(next?.[provider])
    setChecked((c) => ({ ...c, [provider]: left === null ? text : `${text} · 남은 횟수 ${left}회` }))
  }
  const save = () => {
    if (writeRouteBackup(mode, storage)) onDone()
    else setFailed(true)
  }

  return (
    <section className="settings-section" aria-labelledby="settings-route-title">
      <h2 id="settings-route-title">경로 찾기 (카카오 · ODsay 백업)</h2>
      <p className="settings-note">
        가는 길은 카카오 길찾기로 찾습니다. 카카오 쪽이 실패하면 ODsay 로 한 번 더 찾을 수 있습니다. ODsay 무료 요금제는 하루 30회까지라
        백업으로만 씁니다.
      </p>

      <dl className="settings-status">
        {PROVIDER_IDS.map((id) => (
          <Fragment key={id}>
            <dt>{PROVIDERS[id].name}</dt>
            <dd className={providerOff(id, status) ? 'is-off' : undefined}>{providerStatusText(id, status)}</dd>
          </Fragment>
        ))}
      </dl>
      <p className="settings-note">
        횟수는 경로 서버가 켜진 뒤 센 것입니다. 서버를 다시 띄우면 0부터 세고, 같은 키를 다른 곳에서 쓴 횟수는 들어가지 않습니다.
      </p>

      <fieldset className="settings-choices">
        <legend>찾는 방법</legend>
        {BACKUP_MODES.map((value) => (
          <label key={value} className="settings-choice">
            <input type="radio" name="route-backup" value={value} checked={mode === value} onChange={() => setMode(value)} />
            <span>
              <strong>{MODE_TEXT[value].label}</strong>
              <small>{MODE_TEXT[value].help}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="settings-block">
        {PROVIDER_IDS.map((id) => (
          <Fragment key={id}>
            <button type="button" className="settings-button" onClick={() => runTest(id)}>
              {PROVIDERS[id].name} 연결 확인 (1회 사용)
            </button>
            {checked[id] && (
              <p className="settings-result" role="status">
                {checked[id]}
              </p>
            )}
          </Fragment>
        ))}
      </div>

      {failed && (
        <p className="settings-error" role="alert">
          설정을 저장하지 못했습니다. 브라우저가 저장소를 막고 있는지 확인해 주세요.
        </p>
      )}

      <div className="settings-actions">
        <button type="button" className="settings-button is-primary" onClick={save}>
          저장하고 키오스크 화면 열기
        </button>
        <button type="button" className="settings-button" onClick={onDone}>
          저장하지 않고 돌아가기
        </button>
      </div>
    </section>
  )
}
