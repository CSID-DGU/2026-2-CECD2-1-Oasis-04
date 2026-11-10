// reducer 를 React 트리에 연결하는 곳.
// KioskProvider 가 useReducer 를 하나 들고 { state, dispatch } 를 Context 로 내려 준다.
// 화면 컴포넌트는 const { state, dispatch } = useKiosk() 로 꺼내 쓴다.

import { createContext, useContext, useMemo, useReducer } from 'react'
import { kioskReducer, initialState } from './kioskReducer.js'

const KioskContext = createContext(null)

export function KioskProvider({ children }) {
  const [state, dispatch] = useReducer(kioskReducer, initialState)
  // state 가 바뀔 때만 새 객체를 만들어 불필요한 리렌더를 막는다
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <KioskContext.Provider value={value}>{children}</KioskContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- Provider 와 훅을 한 파일에 두는 것이 계획 문서의 구조
export function useKiosk() {
  const ctx = useContext(KioskContext)
  if (ctx === null) {
    throw new Error('useKiosk() 는 <KioskProvider> 안에서만 쓸 수 있습니다')
  }
  return ctx
}
