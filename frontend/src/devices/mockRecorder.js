// 마이크 mock. 실제 마이크 대신 텍스트 입력을 음성으로 취급한다 (계획서 4절 장치 mock, 6절 15번).
// 시나리오는 api/mock/scenario.js 를 같이 읽는다. DevPanel 토글 하나로 서버·장치 실패를 모두 흉내 내기 위해서다.
//
// Phase 3: checkMic 만 구현
// Phase 4: start / onInput / stop (무발화 타이머 config.noSpeechMs, 무음 타이머 config.silenceMs)

import { mockDelay } from '../api/mock/mockDelay.js'
import { getScenario, SCENARIOS } from '../api/mock/scenario.js'

// STARTUP_CHECK 에서 마이크 사용 가능 여부를 묻는다.
//   시나리오 micDown → { available: false }  (STARTUP_CHECK 핸들러가 MIC_OR_STT_UNAVAILABLE 로 바꾼다)
//   그 외           → { available: true }
export async function checkMic() {
  const scenario = getScenario()
  console.log('[mock] checkMic 호출', scenario)
  await mockDelay()

  return { available: scenario !== SCENARIOS.micDown }
}

// Phase 4에서 구현.
// LISTENING 진입 시 호출. 무발화 타이머(config.noSpeechMs)를 가동하고,
// 입력 없이 만료되면 onSpeechEnd({ text: '' }), 첫 입력 뒤에는 무음 타이머(config.silenceMs)로 전환한다.
// eslint-disable-next-line no-unused-vars
export function start({ onSpeechEnd }) {
  throw new Error('Not implemented: mockRecorder.start (Phase 4)')
}

// Phase 4에서 구현.
// ListeningScreen 의 입력창이 바뀔 때마다 호출. 첫 입력 시 무발화 타이머 해제, 무음 타이머 리셋, 텍스트 보관.
// eslint-disable-next-line no-unused-vars
export function onInput(text) {
  throw new Error('Not implemented: mockRecorder.onInput (Phase 4)')
}

// Phase 4에서 구현.
// LISTENING 을 떠날 때(cleanup) 호출. 타이머 둘 다 clear.
export function stop() {
  throw new Error('Not implemented: mockRecorder.stop (Phase 4)')
}
