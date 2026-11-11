// 마이크 mock. 실제 마이크 대신 텍스트 입력을 음성으로 취급한다 (계획서 4절 장치 mock, 6절 15번).
// 시나리오는 api/mock/scenario.js 를 같이 읽는다. DevPanel 토글 하나로 서버·장치 실패를 모두 흉내 내기 위해서다.
//
// 타이머 두 개의 역할 (계획서 2-5절 'LISTENING 책임 분리'):
//   무발화 타이머: start() 직후 config.noSpeechMs 동안 onInput 이 한 번도 안 오면 onSpeechEnd({ text: '' })
//   무음 타이머:   첫 onInput 이후부터 동작. onInput 마다 리셋되고 config.silenceMs 동안 입력이 없으면 onSpeechEnd({ text })
// 먼저 만료되는 쪽이 한 번만 onSpeechEnd 를 부르고, 상태가 바뀌면 LISTENING 핸들러 cleanup 이 stop() 을 호출한다.
//
// StrictMode 대응: start → stop → start 순으로 두 번 불려도 타이머가 겹치지 않도록
// start() 안에서 먼저 stop() 으로 이전 세션을 정리하고 시작한다.
// stop() 은 타이머뿐 아니라 콜백도 비우므로, stop() 이후에는 어떤 경로로도 onSpeechEnd 가 호출되지 않는다.

import { config } from '../config.js'
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

// 현재 녹음 세션. 모듈 변수로 둔 이유: recorder 는 장치 하나를 대표하는 싱글턴이고,
// 화면(onInput)과 effect(start/stop)가 같은 세션을 공유해야 하기 때문이다.
let speechEndCallback = null // start() 에서 받은 onSpeechEnd. stop() 에서 null 로
let noSpeechTimer = null // 무발화 타이머 id
let silenceTimer = null // 무음 타이머 id
let currentText = '' // onInput 으로 받은 마지막 텍스트

function clearTimers() {
  if (noSpeechTimer !== null) {
    clearTimeout(noSpeechTimer)
    noSpeechTimer = null
  }
  if (silenceTimer !== null) {
    clearTimeout(silenceTimer)
    silenceTimer = null
  }
}

// 타이머 만료 시 공통 처리. 콜백을 먼저 꺼내고 세션을 정리한 뒤 호출한다.
// → 콜백 안에서 dispatch 로 상태가 바뀌어 stop() 이 다시 불려도 이중 호출이 생기지 않는다.
function fireSpeechEnd(text, reason) {
  const callback = speechEndCallback
  stop()
  if (!callback) return
  console.log(`[mock] recorder ${reason} → onSpeechEnd`, JSON.stringify(text))
  callback({ text })
}

// LISTENING 진입 시 호출. 무발화 타이머를 가동한다.
// 이미 돌고 있는 세션이 있으면(StrictMode 재실행) 먼저 정리해 타이머가 겹치지 않게 한다.
export function start({ onSpeechEnd }) {
  stop()

  speechEndCallback = onSpeechEnd
  currentText = ''
  console.log('[mock] recorder start (무발화 타이머', config.noSpeechMs, 'ms)')

  noSpeechTimer = setTimeout(() => {
    noSpeechTimer = null
    fireSpeechEnd('', '무발화 타이머 만료')
  }, config.noSpeechMs)
}

// ListeningScreen 의 입력창이 바뀔 때마다 호출.
// 첫 입력이면 무발화 타이머를 해제하고, 무음 타이머는 매번 새로 건다.
// start() 전이나 stop() 후에 오는 입력은 세션이 없으므로 무시한다.
export function onInput(text) {
  if (speechEndCallback === null) return

  currentText = text ?? ''

  if (noSpeechTimer !== null) {
    clearTimeout(noSpeechTimer)
    noSpeechTimer = null
  }

  if (silenceTimer !== null) clearTimeout(silenceTimer)
  silenceTimer = setTimeout(() => {
    silenceTimer = null
    fireSpeechEnd(currentText, '무음 타이머 만료')
  }, config.silenceMs)
}

// LISTENING 을 떠날 때(cleanup) 호출. 타이머 둘 다 해제하고 콜백도 비운다.
// 여러 번 불려도 안전하다 (idempotent).
export function stop() {
  clearTimers()
  speechEndCallback = null
  currentText = ''
}
