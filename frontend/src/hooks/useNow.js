// 지금 시각을 돌려주고, 정한 간격마다 다시 그리게 한다 (Clock, 나중에 경로의 도착 시각).
// 시안(design/mockups/shared/v3.js 의 tick)과 같이 10초마다 본다: 분이 바뀐 뒤 늦어도 10초 안에 띠 시각이 바뀐다.

import { useEffect, useState } from 'react'

export function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
