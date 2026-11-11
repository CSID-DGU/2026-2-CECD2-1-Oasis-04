// 실제 마이크 구현 자리. navigator.mediaDevices.getUserMedia + MediaRecorder 를 쓸 예정.
// mockRecorder 와 함수 이름·시그니처가 같아야 한다 (같은 인터페이스의 두 구현).
// 실제 구현 시 onInput 대신 오디오 레벨로 발화·무음을 감지하고 onSpeechEnd({ audio }) 를 넘기면
// 화면·effect 는 그대로 두고 api.stt 만 { audio } 를 받도록 real/stt.js 에서 처리한다 (계획서 2-5절).

export async function checkMic() {
  throw new Error('Not implemented: realRecorder.checkMic')
}

export function start() {
  throw new Error('Not implemented: realRecorder.start')
}

export function onInput() {
  throw new Error('Not implemented: realRecorder.onInput')
}

export function stop() {
  throw new Error('Not implemented: realRecorder.stop')
}
