// 시작점. 주소 끝이 #settings 면 설정 페이지를, 아니면 키오스크 화면을 그린다.
//
// 키오스크 화면은 그리기 전에 STT 서버와 연동할지부터 정한다 (settings/integration.js).
// api/index.js 와 devices/recorder.js 가 불러올 때 그 값을 한 번 읽으므로, App 은 그 뒤에 불러온다 (동적 import).
// 설정 페이지와 키오스크 화면 사이를 오갈 때(#settings 가 붙거나 떨어질 때)는 화면을 새로 열어 다시 정하게 한다.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { initIntegration } from './settings/integration.js'

const SETTINGS_HASH = '#settings'

async function boot() {
  const root = createRoot(document.getElementById('root'))
  if (window.location.hash === SETTINGS_HASH) {
    const { default: SettingsPage } = await import('./settings/SettingsPage.jsx')
    root.render(
      <StrictMode>
        <SettingsPage />
      </StrictMode>,
    )
    return
  }
  await initIntegration()
  const [{ default: App }, { default: IntegrationNotice }] = await Promise.all([import('./App.jsx'), import('./settings/IntegrationNotice.jsx')])
  root.render(
    <StrictMode>
      <App />
      <IntegrationNotice />
    </StrictMode>,
  )
}

window.addEventListener('hashchange', () => window.location.reload())
boot()
