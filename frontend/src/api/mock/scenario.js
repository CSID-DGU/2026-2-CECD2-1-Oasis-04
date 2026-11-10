// mock 시나리오 저장소 (개발 도구).
// DevPanel 에서 고른 시나리오를 mock API 와 mockRecorder 가 읽어서 실패 케이스를 흉내 낸다.
// 워크플로우 상태가 아니라 개발 도구이므로 reducer 상태에 넣지 않고 모듈 변수로만 둔다.
// (Spring 으로 치면 테스트 프로파일을 바꾸는 토글)

export const SCENARIOS = Object.freeze({
  normal: 'normal', // 모두 정상
  serverDown: 'serverDown', // health → { server: false }  → CHECKING
  sttDown: 'sttDown', // health → { server: true, stt: false } → IDLE_REDUCED
  micDown: 'micDown', // checkMic → { available: false } → IDLE_REDUCED
  routeError: 'routeError', // route → Error('ROUTE_ERROR')
  poisError: 'poisError', // getPois → Error (화면 오류 문구만, 전이 없음)
  qrError: 'qrError', // createQr → Error (화면 오류 문구만, 전이 없음)
})

let current = SCENARIOS.normal

export function getScenario() {
  return current
}

export function setScenario(next) {
  if (!SCENARIOS[next]) {
    console.warn(`[mock] 알 수 없는 시나리오 "${next}" → 무시`)
    return
  }
  current = next
  console.log('[mock] 시나리오 변경', current)
}
