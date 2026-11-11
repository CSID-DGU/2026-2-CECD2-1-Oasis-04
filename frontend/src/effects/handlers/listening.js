// LISTENING 진입 시 실행되는 effect 핸들러 (계획서 2-5절 표, 'LISTENING 책임 분리').
// 하는 일은 recorder 를 켜고 끄는 것뿐이다. 타이머(무발화 config.noSpeechMs, 무음 config.silenceMs)는
// recorder 가 관리하고, 먼저 만료되는 쪽이 onSpeechEnd({ text }) 를 부르면 여기서 SPEECH_END 로 바꾼다.
// '다 말했어요' / '취소' / '처음으로' 버튼은 ListeningScreen 이 직접 dispatch 한다.
//
// StrictMode 규칙: cleanup 에서 recorder.stop(). stop() 은 타이머와 콜백을 모두 비우므로
// 상태를 떠난 뒤에는 onSpeechEnd 가 호출될 수 없다 (cancelled 플래그와 같은 역할을 recorder 가 한다).
// start → stop → start 로 두 번 불려도 recorder.start() 가 이전 세션을 먼저 정리하므로 타이머가 겹치지 않는다.

import { EVENTS } from '../../state/events.js'

export function listeningHandler(state, dispatch, { recorder }) {
  recorder.start({
    onSpeechEnd: ({ text }) => {
      dispatch({ type: EVENTS.SPEECH_END, text })
    },
  })

  return () => {
    recorder.stop()
  }
}
