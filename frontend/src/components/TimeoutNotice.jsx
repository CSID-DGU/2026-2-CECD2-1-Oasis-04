// 남은 시간 알림 (디자인 문서 11-4절, 시안 confirmed/pick.css 의 .thin-alert, timeout-notice.js).
// 얇은 띠 오른쪽의 날짜·시각 자리를 대신하는 검정 판. 띠 높이와 본문은 움직이지 않는다.
// 움직임은 숫자가 1초에 한 번 바뀌는 것뿐이다 (숫자 폭 고정, 나타나기·깜빡임 없음).
//
// props
//   secondsLeft  남은 초

import Icon from './Icon.jsx'
import './TimeoutNotice.css'

export default function TimeoutNotice({ secondsLeft }) {
  return (
    <div className="timeout-notice" role="status">
      <Icon name="schedule" className="timeout-notice-icon" />
      <p>
        <b>
          <span className="timeout-notice-left">{secondsLeft}</span>초 뒤에 처음으로 돌아가요
        </b>
        <span>계속하시려면 화면을 눌러 주세요</span>
      </p>
    </div>
  )
}
