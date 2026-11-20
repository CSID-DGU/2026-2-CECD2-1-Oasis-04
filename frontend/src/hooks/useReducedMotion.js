// 움직임 줄이기 설정 (prefers-reduced-motion: reduce) 을 읽는다. 설정이 바뀌면 다시 그린다 (디자인 문서 3-5절).

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(QUERY).matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined
    const mq = matchMedia(QUERY)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}
