// 무입력 남은 초 (디자인 문서 11-4절). effects/inactivityClock.js 의 마감 시각을 읽어 "마감 − 지금" 을 초로 올림한다.
// 무입력 타이머가 없으면(무입력 화면이 아니면) null.
// 숫자가 바뀌는 순간(초 경계)에만 다시 그린다. 화면을 누르면 핸들러가 마감 시각을 새로 적으므로 바로 다시 계산된다.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { getInactivityDeadline, subscribeInactivityDeadline } from '../effects/inactivityClock.js'

const SECOND_MS = 1000

/** 남은 시간이 이 초 이하일 때만 알림을 보인다 (11-4절) */
export const NOTICE_SECONDS = 15

export function secondsLeftOf(deadline, now) {
  if (deadline === null) return null
  return Math.max(0, Math.ceil((deadline - now) / SECOND_MS))
}

export function useInactivityCountdown() {
  const deadline = useSyncExternalStore(subscribeInactivityDeadline, getInactivityDeadline, getInactivityDeadline)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (deadline === null) return undefined
    let timer = null
    const tick = () => {
      const t = Date.now()
      setNow(t)
      const remain = deadline - t
      if (remain <= 0) return
      // 다음 초 경계까지 기다린다 (숫자가 1초에 한 번만 바뀐다)
      timer = setTimeout(tick, remain % SECOND_MS || SECOND_MS)
    }
    tick()
    return () => clearTimeout(timer)
  }, [deadline])

  return secondsLeftOf(deadline, now)
}
