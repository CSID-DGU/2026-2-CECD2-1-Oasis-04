// mock API 공통 지연 헬퍼.
// 실제 네트워크처럼 300~800ms 기다린 뒤 값을 돌려준다. 스피너 화면이 눈에 보이게 하기 위한 용도다.
// (Spring 으로 치면 테스트용 Thread.sleep 을 Promise 로 감싼 것)
//
// 사용법:  await mockDelay();          → 지연만
//          return mockDelay(value);    → 지연 후 value 를 resolve

const MIN_MS = 300
const MAX_MS = 800

export function mockDelay(value) {
  const ms = MIN_MS + Math.floor(Math.random() * (MAX_MS - MIN_MS + 1))
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}
