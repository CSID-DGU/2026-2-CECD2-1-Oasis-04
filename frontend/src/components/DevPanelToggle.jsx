// DevPanel 을 보일지 말지 정하는 스위치. DevPanel 자체는 건드리지 않고 바깥에서 감싼다.
//
//   기본값: 개발 서버(npm run dev)에서는 보임, 빌드 결과(npm run build / preview)에서는 숨김.
//           import.meta.env.DEV 는 Vite 가 빌드 시점에 true/false 로 박아 넣는 값이라 런타임 설정이 필요 없다.
//   토글:   Ctrl + Shift + D 를 누르면 켜고 끈다. 시연 중 상태를 확인해야 할 때 쓴다.
//           (키 이벤트는 inactivity 핸들러의 document keydown 리스너에도 잡히므로 무입력 타이머가 한 번 리셋된다.
//            개발 도구를 여는 동작이라 사용자 입력으로 쳐도 무방하다.)
//
// 워크플로우(상태·전이·핸들러)와 무관한 개발 도구다. reducer 상태가 아니라 이 컴포넌트의 로컬 state 로만 둔다.

import { useEffect, useState } from 'react'
import DevPanel from './DevPanel.jsx'

/** 토글 단축키. 브라우저 기본 동작(Chrome 의 Ctrl+Shift+D = 모든 탭 북마크)과 겹치므로 preventDefault 한다. */
function isToggleShortcut(e) {
  return e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'd'
}

export default function DevPanelToggle() {
  const [visible, setVisible] = useState(import.meta.env.DEV)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!isToggleShortcut(e)) return
      e.preventDefault()
      setVisible((v) => !v)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return visible ? <DevPanel /> : null
}
