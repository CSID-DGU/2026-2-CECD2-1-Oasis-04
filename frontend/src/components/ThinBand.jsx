// 얇은 띠: IDLE·IDLE_REDUCED 를 뺀 화면의 위쪽 96px (디자인 문서 8-1절, 시안 shared/flow.css 의 .thin).
//   왼쪽   로고 + 서비스 이름 (src/brand.js, 둘 다 임시)
//   가운데 지금 계신 곳 이름 (LocationContext). 큰 띠와 같은 규칙(view/placeName.js 의 bandPlaceName: 끝의 "역"·"정류장" 떼기, 한 줄).
//          장소 정보(place)가 없어도 위치 응답에 이름이 있으면 그 이름을 같은 규칙으로 보인다. 받기 전이거나 이름도 없으면 비운다
//   오른쪽 날짜와 시각. 무입력 화면에서 남은 시간이 15초 이하면 이 자리를 남은 시간 알림(TimeoutNotice)이 대신한다 (11-4절)
//
// props
//   countdown  true 면 무입력 남은 시간을 읽어 알림을 보인다. 무입력 화면 6개만 켠다

import Icon from './Icon.jsx'
import Clock from './Clock.jsx'
import TimeoutNotice from './TimeoutNotice.jsx'
import { useInactivityCountdown, NOTICE_SECONDS } from '../hooks/useInactivityCountdown.js'
import { SERVICE_NAME, LOGO_ICON } from '../brand.js'
import { useLocation } from '../state/LocationContext.jsx'
import { bandPlaceName } from '../view/placeName.js'
import './ThinBand.css'

export default function ThinBand({ countdown = false }) {
  const { location } = useLocation()
  const secondsLeft = useInactivityCountdown()
  const showNotice = countdown && secondsLeft !== null && secondsLeft <= NOTICE_SECONDS
  return (
    <header className="thin-band">
      <div className="thin-band-brand">
        <Icon name={LOGO_ICON} className="thin-band-logo" />
        <span>{SERVICE_NAME}</span>
      </div>
      <div className="thin-band-place">{bandPlaceName(location)}</div>
      {showNotice ? <TimeoutNotice secondsLeft={secondsLeft} /> : <Clock className="thin-band-now" />}
    </header>
  )
}
