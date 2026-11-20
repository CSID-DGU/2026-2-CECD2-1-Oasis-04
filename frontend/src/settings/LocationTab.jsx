// 설정 페이지의 '위치' 탭. 키오스크가 놓인 곳("지금 계신 곳")을 어떻게 정할지 고른다 (settings/kioskPlace.js).
//
//   현재 위치로 찾기  브라우저 위치로 가장 가까운 역·정류장을 찾는다. '지금 위치 확인' 으로 브라우저가 위치를 주는지, 오차가 얼마인지 본다
//   직접 지정         역 번호, 정류장 번호 또는 이름으로 찾아서 고른다. GPS·무선랜이 없는 PC 에서 쓴다
//
// 찾기는 STT 서버(GET /api/v1/places)가 한다. 서버가 꺼져 있으면 찾을 수 없다.
// 정한 곳은 STT 서버와 연동이 켜져 있을 때 쓰인다. 연동이 꺼져 있으면 화면에는 연습용 장소가 나온다.

import { useState } from 'react'
import { findPlaces, readPosition } from '../api/real/location.js'
import { placeText, positionText, readKioskPlace, writeKioskPlace } from './kioskPlace.js'

export default function LocationTab({ storage, onDone, find = findPlaces, locate = readPosition }) {
  const [saved] = useState(() => readKioskPlace(storage))
  const [mode, setMode] = useState(saved.mode)
  const [place, setPlace] = useState(saved.place ?? null)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState({ state: 'idle', places: [] }) // idle | loading | done | error
  const [check, setCheck] = useState(null) // '지금 위치 확인' 의 결과 문장. null = 아직 안 함
  const [failed, setFailed] = useState(false)

  const runSearch = async (e) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearch({ state: 'loading', places: [] })
    try {
      setSearch({ state: 'done', places: await find(q) })
    } catch {
      setSearch({ state: 'error', places: [] })
    }
  }
  const runCheck = async () => {
    setCheck('확인하는 중입니다')
    setCheck(positionText(await locate()))
  }
  const canSave = mode === 'auto' || Boolean(place)
  const save = () => {
    if (writeKioskPlace(mode === 'manual' ? { mode, place } : { mode: 'auto' }, storage)) onDone()
    else setFailed(true)
  }

  return (
    <section className="settings-section" aria-labelledby="settings-location-title">
      <h2 id="settings-location-title">지금 계신 곳 (키오스크 위치)</h2>
      <p className="settings-note">
        첫 화면 위쪽 띠에 보이는 역·정류장이고, 길 안내의 출발지입니다. 음성 인식 서버와 연동이 켜져 있을 때 쓰입니다.
      </p>

      <fieldset className="settings-choices">
        <legend>정하는 방법</legend>
        <label className="settings-choice">
          <input type="radio" name="kiosk-place" value="auto" checked={mode === 'auto'} onChange={() => setMode('auto')} />
          <span>
            <strong>현재 위치로 찾기</strong>
            <small>
              브라우저가 알려 주는 위치(GPS·무선랜)로 가장 가까운 역·정류장을 찾습니다. 유선 인터넷만 쓰는 PC 는 오차가 커서 찾지 못합니다.
              찾지 못하면 서버에 적어 둔 고정 위치가 쓰입니다.
            </small>
          </span>
        </label>
        <label className="settings-choice">
          <input type="radio" name="kiosk-place" value="manual" checked={mode === 'manual'} onChange={() => setMode('manual')} />
          <span>
            <strong>직접 지정</strong>
            <small>역 번호, 정류장 번호 또는 이름으로 찾아서 고릅니다.</small>
          </span>
        </label>
      </fieldset>

      {mode === 'auto' && (
        <div className="settings-block">
          <button type="button" className="settings-button" onClick={runCheck}>
            지금 위치 확인
          </button>
          {check && (
            <p className="settings-result" role="status">
              {check}
            </p>
          )}
        </div>
      )}

      {mode === 'manual' && (
        <div className="settings-block">
          <form className="settings-search" onSubmit={runSearch}>
            <label htmlFor="settings-place-query">역 번호, 정류장 번호 또는 이름</label>
            <div className="settings-search-row">
              <input
                id="settings-place-query"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="예) 130, 01-013, 종로3가"
                autoComplete="off"
              />
              <button type="submit" className="settings-button" disabled={search.state === 'loading'}>
                찾기
              </button>
            </div>
          </form>

          {search.state === 'loading' && <p className="settings-result">찾는 중입니다</p>}
          {search.state === 'error' && (
            <p className="settings-error" role="alert">
              찾지 못했습니다. 음성 인식 서버가 켜져 있는지 확인해 주세요.
            </p>
          )}
          {search.state === 'done' && search.places.length === 0 && <p className="settings-result">해당하는 역·정류장이 없습니다.</p>}
          {search.places.length > 0 && (
            <ul className="settings-places">
              {search.places.map((p) => (
                <li key={p.poiId}>
                  <label className="settings-place">
                    <input type="radio" name="kiosk-place-pick" checked={place?.poiId === p.poiId} onChange={() => setPlace(p)} />
                    <span>{placeText(p)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <p className="settings-result" role="status">
            고른 곳: <strong>{place ? placeText(place) : '아직 고르지 않았습니다'}</strong>
          </p>
        </div>
      )}

      {failed && (
        <p className="settings-error" role="alert">
          설정을 저장하지 못했습니다. 브라우저가 저장소를 막고 있는지 확인해 주세요.
        </p>
      )}

      <div className="settings-actions">
        <button type="button" className="settings-button is-primary" onClick={save} disabled={!canSave}>
          저장하고 키오스크 화면 열기
        </button>
        <button type="button" className="settings-button" onClick={onDone}>
          저장하지 않고 돌아가기
        </button>
      </div>
    </section>
  )
}
