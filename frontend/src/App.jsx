// 앱의 뼈대. 세 가지만 한다.
//   1. KioskProvider 로 감싸서 모든 화면이 { state, dispatch } 를 쓸 수 있게 한다
//   2. useKioskEffects() 를 한 번 호출해 상태 진입 시 API 호출·타이머가 돌게 한다
//   3. 현재 상태에 맞는 화면 하나를 SCREEN_BY_STATE 에서 골라 보여 준다 (라우터 역할. 키오스크는 URL 이 없다)
// useKiosk() 는 Provider 안에서만 쓸 수 있으므로, 2·3 은 Provider 안쪽의 작은 컴포넌트로 한 단계 내린다.

import { KioskProvider, useKiosk } from './state/KioskContext.jsx'
import { useKioskEffects } from './effects/useKioskEffects.js'
import { SCREEN_BY_STATE } from './screens/index.js'
import DevPanel from './components/DevPanel.jsx'

// 화면을 그리지 않고 effect 만 돌리는 컴포넌트. 앱 전체에서 정확히 한 번만 마운트된다.
function KioskEffects() {
  useKioskEffects()
  return null
}

function CurrentScreen() {
  const { state } = useKiosk()
  const Screen = SCREEN_BY_STATE[state.state]
  if (!Screen) {
    // 상태 1 : 화면 1 규칙이 깨졌을 때만 온다. 조용히 빈 화면을 내지 않도록 눈에 띄게 알린다.
    return <h1>화면 없음: {state.state}</h1>
  }
  return <Screen />
}

export default function App() {
  return (
    <KioskProvider>
      <KioskEffects />
      <CurrentScreen />
      <DevPanel />
    </KioskProvider>
  )
}
