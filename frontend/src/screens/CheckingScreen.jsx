// CHECKING: 0 점검 중. 버튼 없음. 재시도 타이머(HEALTH_RETRY_TIMER)는 effect(handlers/checking.js) 담당.
// 이 화면은 다시 해 보기까지 남은 초를 보여 주기만 한다. 전이는 내지 않는다.
// 모양: 기다림 틀, 고리 가운데에 남은 초, 호가 남은 시간만큼 줄어든다 (디자인 문서 10-3절. 오류 색은 쓰지 않는다)
//
// 남은 초는 "마감 시각 − 지금" 으로 계산한다 (hooks/useCountdown.js). 마감은 화면이 처음 그려질 때
// config.healthRetryMs 뒤로 정한다 — effect 가 타이머를 거는 때와 같다.
import WaitFrame from '../components/WaitFrame.jsx'
import { useCountdown } from '../hooks/useCountdown.js'
import { STATES } from '../state/states.js'
import { SCREEN_TITLES } from './titles.js'
import { config } from '../config.js'

export default function CheckingScreen() {
  const countdown = useCountdown(config.healthRetryMs)
  return (
    <WaitFrame
      countdown={countdown}
      core={SCREEN_TITLES[STATES.CHECKING]}
      sub={`잠시 문제가 생겼어요. ${countdown.seconds}초 뒤에 다시 해 볼게요`}
    />
  )
}
