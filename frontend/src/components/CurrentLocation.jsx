// 첫 화면(IDLE, IDLE_REDUCED)에 '지금 계신 곳' 한 줄을 보여 준다.
//
// 화면이 열릴 때 api.getLocation() 을 직접 부른다. getPois·createQr 처럼 상태 전이를 일으키지 않는 "표시용" 조회라서
// 실패해도 이벤트를 dispatch 하지 않고 줄을 비워 둔다 (ManualSelectScreen 과 같은 방식, 계획서 2-3절 예외).
// real 구현은 이때 브라우저 위치(GPS)를 서버에 알리고, 서버는 그 위치를 이 키오스크의 출발지로 기억한다.
// 그래서 이 줄에 보이는 곳과 이후 길 안내의 출발지가 같다. 처음 화면으로 돌아올 때마다 다시 확인한다.
//
// 위치를 받지 못해 서버 설정의 고정 위치를 쓰게 되면 그 사실을 작은 글씨로 함께 알린다 (옮겨 다니며 시험할 때 확인용).

import { useEffect, useState } from 'react'
import { api } from '../api/index.js'

const FALLBACK_HINT = {
  PERMISSION_DENIED: '위치 사용이 꺼져 있어서 미리 정해 둔 곳으로 안내해요',
  LOW_ACCURACY: '위치가 정확하지 않아서 미리 정해 둔 곳으로 안내해요',
  OUT_OF_AREA: '안내할 수 있는 지역 밖이라 미리 정해 둔 곳으로 안내해요',
}
const DEFAULT_FALLBACK_HINT = '위치를 확인하지 못해서 미리 정해 둔 곳으로 안내해요'

export default function CurrentLocation() {
  // 진행 상태와 결과를 한 객체로 묶는다 (ManualSelectScreen 과 같은 이유)
  const [load, setLoad] = useState({ status: 'loading', location: null })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const location = await api.getLocation()
        if (cancelled) return
        setLoad({ status: 'ready', location })
      } catch (e) {
        if (cancelled) return
        console.warn('[currentLocation] getLocation 실패:', e?.message)
        // 전이 없음: 위치 줄만 비운다. 길 안내는 서버의 고정 위치로 계속할 수 있다.
        setLoad({ status: 'error', location: null })
      }
    })()
    return () => {
      cancelled = true
    }
  }, []) // 화면이 열릴 때 한 번. 처음 화면으로 돌아올 때마다 새로 마운트되므로 그때마다 다시 확인한다.

  if (load.status === 'loading') return <p className="location">지금 계신 곳을 확인하고 있어요</p>
  if (load.status === 'error' || !load.location?.text) return null

  const { text, source, reason } = load.location
  return (
    <>
      <p className="location">{text}</p>
      {source !== 'GPS' && reason && <p className="hint">{FALLBACK_HINT[reason] ?? DEFAULT_FALLBACK_HINT}</p>}
    </>
  )
}
