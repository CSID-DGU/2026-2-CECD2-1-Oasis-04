// 지금 계신 곳(위치 조회 결과)을 앱 전체에 나눠 주는 곳 (계획서 4-2절, 2026-11-19 결정).
//
// 왜 reducer 가 아니라 Context 인가: 얇은 띠(ThinBand)가 모든 화면에서 장소 이름을 쓴다. reducer 에 넣으려면
// 위치 조회 결과를 싣는 새 이벤트가 필요한데, 상태·전이·이벤트는 디자인 작업으로 늘리지 않는다 (CLAUDE.md).
// 그래서 위치는 "표시용 조회"로 남기고(getPois·createQr 와 같은 예외), 결과만 여기서 들고 있는다.
//
// 언제 조회하나: 처음 화면(IDLE, IDLE_REDUCED)에 들어갈 때마다. 예전 CurrentLocation 이 화면이 열릴 때 부르던 것과 같은 때다.
// real 구현은 이때 브라우저 위치를 서버에 알리고, 서버는 그 위치를 이 키오스크의 출발지로 기억한다.
// 실패하면 마지막으로 받은 결과를 그대로 둔다 (띠의 이름이 갑자기 사라지지 않게). 한 번도 못 받았으면 status 가 'error'.
//
// 값: { location, status }
//   location  api.getLocation() 의 결과 ({ name, text, source, reason, place, ... }) 또는 null
//             place 는 큰 띠의 장소 정보 (디자인 문서 8-5절). 띠 이름은 view/placeName.js 의 bandPlaceName 으로 만든다
//   status    'loading'(아직 결과 없음) | 'ready' | 'error'(결과 없이 실패)

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../api/index.js'
import { useKiosk } from './KioskContext.jsx'
import { STATES } from './states.js'

const LocationContext = createContext(null)
// 개발자 패널이 mock 장소를 바꾼 뒤 바로 다시 조회하게 하는 함수. 값 모양({ location, status })을 바꾸지 않으려고 따로 둔다
const LocationRefreshContext = createContext(() => {})

const HOME_STATES = new Set([STATES.IDLE, STATES.IDLE_REDUCED])

export function LocationProvider({ children }) {
  const { state } = useKiosk()
  // IDLE ↔ IDLE_REDUCED 사이를 오갈 때도 다시 조회하도록, "처음 화면에 들어간 횟수"가 아니라 상태 이름을 쓴다
  const homeState = HOME_STATES.has(state.state) ? state.state : null
  const [value, setValue] = useState({ location: null, status: 'loading' })
  const [asked, setAsked] = useState(0) // 개발자 패널이 다시 조회를 부탁한 횟수
  const refresh = useCallback(() => setAsked((n) => n + 1), [])
  const answered = useRef(0) // 마지막으로 조회한 때의 asked

  useEffect(() => {
    // 처음 화면에 들어갔을 때, 또는 개발자 패널이 새로 부탁했을 때만 조회한다 (처음 화면을 떠날 때는 조회하지 않는다)
    const newAsk = asked !== answered.current
    answered.current = asked
    if (homeState === null && !newAsk) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const location = await api.getLocation()
        if (cancelled) return
        setValue({ location, status: 'ready' })
      } catch (e) {
        if (cancelled) return
        console.warn('[location] getLocation 실패:', e?.message)
        // 전이 없음. 마지막 결과가 있으면 그대로 두고, 없을 때만 오류로 둔다
        setValue((prev) => (prev.location ? prev : { location: null, status: 'error' }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [homeState, asked])

  return (
    <LocationRefreshContext.Provider value={refresh}>
      <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
    </LocationRefreshContext.Provider>
  )
}

// 정해 둔 값을 그대로 나눠 주는 Provider. 조회하지 않는다. 화면 테스트가 쓴다 (screens/__tests__/providers.jsx, 계획서 6-2절)
export function StaticLocationProvider({ value = { location: null, status: 'ready' }, children }) {
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- Provider 와 훅을 한 파일에 둔다 (KioskContext 와 같은 구조)
export function useLocation() {
  const ctx = useContext(LocationContext)
  if (ctx === null) {
    throw new Error('useLocation() 은 <LocationProvider> 안에서만 쓸 수 있습니다')
  }
  return ctx
}

/** 위치를 다시 조회하는 함수. 개발자 패널의 '장소' 고르기가 쓴다 (전이 없음) */
// eslint-disable-next-line react-refresh/only-export-components -- 위와 같음
export function useLocationRefresh() {
  return useContext(LocationRefreshContext)
}
