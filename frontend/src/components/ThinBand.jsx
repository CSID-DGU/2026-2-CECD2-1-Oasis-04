// 얇은 띠: IDLE·IDLE_REDUCED 를 뺀 화면의 위쪽 96px (디자인 문서 8-1절, 시안 shared/flow.css 의 .thin).
//   왼쪽   로고 + 서비스 이름 (src/brand.js, 둘 다 임시)
//   가운데 지금 계신 곳 이름 (LocationContext). 받기 전이거나 못 받았으면 비운다
//   오른쪽 날짜와 시각. 무입력 남은 시간 알림은 이 자리에 들어온다 (6단계에서 secondsLeft 로 연결, 지금은 늘 시각)
//
// 이름 끝의 "역"·"정류장" 떼기(7절 규칙 2)는 장소 종류(place.type)가 생기는 7단계에서 view/placeName.js 로 붙인다.

import Icon from './Icon.jsx'
import Clock from './Clock.jsx'
import { SERVICE_NAME, LOGO_ICON } from '../brand.js'
import { useLocation } from '../state/LocationContext.jsx'
import './ThinBand.css'

export default function ThinBand() {
  const { location } = useLocation()
  return (
    <header className="thin-band">
      <div className="thin-band-brand">
        <Icon name={LOGO_ICON} className="thin-band-logo" />
        <span>{SERVICE_NAME}</span>
      </div>
      <div className="thin-band-place">{location?.name ?? ''}</div>
      <Clock className="thin-band-now" />
    </header>
  )
}
