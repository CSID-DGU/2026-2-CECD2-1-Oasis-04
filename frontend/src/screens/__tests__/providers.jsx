// 화면 테스트용 Provider 도우미 (계획서 6-2절 "화면 테스트가 Context 를 못 찾아 실패").
// 새 틀(FlowFrame)의 얇은 띠가 LocationContext 를 읽으므로, 화면을 그릴 때 이것으로 감싼다.
// KioskContext 는 각 테스트가 vi.mock 으로 가짜 useKiosk 를 넣는다 (state 를 테스트마다 바꾸려고).
//
// 쓰는 법: root.render(withProviders(<ManualSelectScreen />))
//          renderToStaticMarkup(withProviders(<ConfirmingScreen />, { location: { name: '종로3가' } }))

import { StaticLocationProvider } from '../../state/LocationContext.jsx'

export function withProviders(element, { location = null } = {}) {
  return <StaticLocationProvider value={{ location, status: location ? 'ready' : 'error' }}>{element}</StaticLocationProvider>
}
