// 마감까지 남은 시간 (CHECKING 의 다시 해 보기까지 남은 초와 줄어드는 호. 디자인 문서 10-3절).
// 마감 시각은 처음 그릴 때 한 번 정하고, 남은 시간은 "마감 − 지금" 으로 계산한다 (매초 1 씩 빼면 타이머와 어긋난다).
//   보통      화면이 그릴 때마다(requestAnimationFrame) 호가 매끄럽게 줄어든다
//   움직임 줄이기  1초에 한 번만 바뀐다. 호도 숫자와 같이 1초 단위로 줄어든다
// 돌려주는 값: { seconds(올림한 남은 초), progress(남은 비율 0~1) }

import { useEffect, useState } from 'react'
import { useReducedMotion } from './useReducedMotion.js'

const SECOND_MS = 1000

export function countdownView(totalMs, remainMs, stepped) {
  const remain = Math.max(0, Math.min(totalMs, remainMs))
  const seconds = Math.ceil(remain / SECOND_MS)
  if (totalMs <= 0) return { seconds: 0, progress: 0 }
  const progress = stepped ? Math.min(1, (seconds * SECOND_MS) / totalMs) : remain / totalMs
  return { seconds, progress }
}

export function useCountdown(totalMs) {
  const reduced = useReducedMotion()
  const [deadline] = useState(() => Date.now() + totalMs)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    if (reduced) {
      const id = setInterval(() => setNow(Date.now()), SECOND_MS)
      return () => clearInterval(id)
    }
    let frame = 0
    const tick = () => {
      if (cancelled) return
      setNow(Date.now())
      if (Date.now() < deadline) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [reduced, deadline])

  return countdownView(totalMs, deadline - now, reduced)
}
