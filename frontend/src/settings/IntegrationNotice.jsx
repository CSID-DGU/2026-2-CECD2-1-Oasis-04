// 실제 모드로 띄웠는데 STT 서버 연동이 꺼져 있을 때 화면 구석에 보이는 알림.
// 이때 화면에 나오는 목적지와 경로는 연습용 데이터라서, 실제 안내로 착각하지 않게 알린다. 누르면 설정 페이지가 열린다.
// 연습 모드(npm run dev)와 시연 모드(npm run dev:demo)는 원래 연습용 데이터로 도는 방식이라 알리지 않는다.
// 키오스크 무대 밖에 그린다 (DevPanel 과 같은 자리 규칙. App 을 건드리지 않으려고 main.jsx 가 App 옆에 둔다).

import { getIntegration, shouldNotify } from './integration.js'
import './SettingsPage.css'

export default function IntegrationNotice() {
  if (!shouldNotify(getIntegration())) return null
  return (
    <a className="integration-notice" href="#settings">
      서버 연동 꺼짐 · 연습용 데이터로 보여 주는 중 (설정)
    </a>
  )
}
