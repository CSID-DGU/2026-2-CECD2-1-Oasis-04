// mock API 공통 지연 헬퍼.
// 실제 네트워크처럼 300~800ms 기다린 뒤 값을 돌려준다. 스피너 화면이 눈에 보이게 하기 위한 용도다.
// (Spring 으로 치면 테스트용 Thread.sleep 을 Promise 로 감싼 것)
//
// 사용법:  await mockDelay();          → 지연만
//          return mockDelay(value);    → 지연 후 value 를 resolve

import { config } from '../../config.js'

const MIN_MS = 300
const MAX_MS = 800

export function mockDelay(value) {
  const ms = MIN_MS + Math.floor(Math.random() * (MAX_MS - MIN_MS + 1))
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

// 기다림 화면(RESOLVING, ROUTING)을 만드는 호출용 지연. config.mockWaitMs(.env 의 VITE_MOCK_WAIT_MS)가 있으면
// 그 시간에 share 를 곱한 만큼 기다린다. RESOLVING 은 stt·resolve 두 번 부르므로 각각 share 0.5 로 합이 mockWaitMs 가 된다.
// 값이 없으면(개발 기본) mockDelay 와 같다. 시연 모드(.env.demo)는 기다림 화면이 1초 넘게 보이게 1500ms 로 둔다
export function mockWaitDelay(value, share = 1) {
  if (!config.mockWaitMs) return mockDelay(value)
  return new Promise((resolve) => setTimeout(() => resolve(value), config.mockWaitMs * share))
}
