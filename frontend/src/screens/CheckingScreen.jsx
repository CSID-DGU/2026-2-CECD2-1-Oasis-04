// CHECKING: 0 점검 중. 버튼 없음. 재시도 타이머(HEALTH_RETRY_TIMER)는 effect(handlers/checking.js) 담당.
// 이 화면은 "몇 초 뒤 다시 시도하는지" 를 1초마다 줄여 가며 보여 주기만 한다. 전이는 내지 않는다.
//
// 남은 초는 "매초 1 씩 빼기" 가 아니라 "마감 시각 − 지금" 으로 계산한다.
// setInterval 은 정확히 1초마다 돌지 않으므로(탭 비활성화 등) 빼기 방식은 effect 타이머와 어긋날 수 있다.
// 마감 시각은 화면이 처음 그려질 때 한 번만 정한다 (useState 초기화 함수).
import { useEffect, useState } from 'react'
import { STATES } from '../state/states.js'
import { config } from '../config.js'

const TICK_MS = 1000 // 표시 갱신 주기. 전이 시간값이 아니라 화면 갱신 간격이라 config 에 두지 않는다

function secondsLeft(deadline) {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
}

export default function CheckingScreen() {
  const [deadline] = useState(() => Date.now() + config.healthRetryMs)
  const [remaining, setRemaining] = useState(() => secondsLeft(deadline))

  useEffect(() => {
    const interval = setInterval(() => setRemaining(secondsLeft(deadline)), TICK_MS)
    // 화면이 사라질 때(상태가 바뀔 때, StrictMode 1차 실행 뒤) 반드시 멈춘다
    return () => clearInterval(interval)
  }, [deadline])

  return (
    <section>
      <h1>{STATES.CHECKING}</h1>
      <p>서버 연결 중, 잠시 후 다시 시도합니다</p>
      <p>{remaining}초 뒤 다시 시도</p>
    </section>
  )
}
