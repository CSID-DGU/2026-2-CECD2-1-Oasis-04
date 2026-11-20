// 시연 모드의 발표자 키 (npm run dev:demo 에서만 그린다, App.jsx). 화면에는 아무것도 그리지 않는다.
// 키는 확정 시안 demo.html 과 같다:
//   → 또는 PageDown  다음: 지금 화면의 next 이벤트를 보낸다 (화면 버튼·기다림 화면 effect 가 내는 것과 같은 이벤트)
//   ← 또는 PageUp    이전: 처음부터(DEV_RESET) 앞 화면까지의 이벤트를 한 번에 보내 바로 앞 화면에 선다
//   Home             이 흐름의 처음 화면
//   1 ~ 5            그 흐름의 처음 화면 (흐름 목록은 demo/demoFlows.js)
// 스페이스·Enter 는 쓰지 않는다. 실제 앱에서는 포커스된 버튼을 누르는 키라서 한 번에 두 번 넘어간다.
// 화면을 손으로 눌러 넘겨도 된다. 상태가 바뀔 때마다 지금 화면이 흐름의 몇 번째인지 다시 찾는다(stepIndexOf).
//
// 새 상태·전이·이벤트는 없다. DEV_RESET 은 원래 있던 개발 도구 이벤트다(state/events.js DEV_EVENTS).
// 흐름의 위치는 화면 표시와 상관없는 발표 도구 값이라 reducer 가 아니라 ref 에 둔다 (DevPanel 의 시나리오처럼).

import { useEffect, useEffectEvent, useRef } from 'react'
import { useKiosk } from '../state/KioskContext.jsx'
import { setScenario } from '../api/mock/scenario.js'
import { setDemoSpeech } from '../devices/mockRecorder.js'
import { DEMO_FLOWS, actionsTo, nextActionOf, stepIndexOf } from './demoFlows.js'

const NEXT_KEYS = new Set(['ArrowRight', 'PageDown'])
const PREV_KEYS = new Set(['ArrowLeft', 'PageUp'])
const TYPING = new Set(['INPUT', 'SELECT', 'TEXTAREA']) // DevPanel 을 열어 글을 넣을 때는 키를 가로채지 않는다

export default function DemoKeys() {
  const { state, dispatch } = useKiosk()
  const pos = useRef({ flow: 0, index: 0 })

  // 화면이 바뀌면(키든 손이든 기다림 화면이든) 흐름 위치를 맞추고, LISTENING 이면 이번에 들을 문장을 녹음기에 넣는다
  useEffect(() => {
    const flow = DEMO_FLOWS[pos.current.flow]
    const i = stepIndexOf(flow, state.state, pos.current.index)
    if (i >= 0) pos.current.index = i
    setDemoSpeech(flow.steps[pos.current.index]?.say ?? '')
  }, [state.state])

  const jump = useEffectEvent((flowIndex, index) => {
    const flow = DEMO_FLOWS[flowIndex]
    setScenario(flow.scenario)
    pos.current = { flow: flowIndex, index }
    setDemoSpeech(flow.steps[index].say ?? '')
    for (const action of actionsTo(flow, index)) dispatch(action)
  })

  const onKeyDown = useEffectEvent((e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || TYPING.has(e.target?.tagName)) return
    const flow = DEMO_FLOWS[pos.current.flow]
    const index = stepIndexOf(flow, state.state, pos.current.index)

    if (/^[1-5]$/.test(e.key)) jump(Number(e.key) - 1, 0)
    else if (e.key === 'Home') jump(pos.current.flow, 0)
    else if (PREV_KEYS.has(e.key)) {
      if (index > 0) jump(pos.current.flow, index - 1)
    } else if (NEXT_KEYS.has(e.key)) {
      const action = index >= 0 ? nextActionOf(flow.steps[index], state) : null
      if (action) dispatch(action)
    } else return
    e.preventDefault()
  })

  useEffect(() => {
    const listener = (e) => onKeyDown(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  return null
}
