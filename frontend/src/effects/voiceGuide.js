// 음성 안내: 지금 화면이 읽어 달라고 한 문장을 들고 있다가 읽고, '다시 듣기' 를 누르면 같은 문장을 다시 읽는다.
//
//   say(lines)   화면이 열리거나 읽을 내용이 바뀔 때 (effects/useSay.js). 읽던 것은 멈추고 새로 읽는다
//   replay()     '다시 듣기' 버튼 (components/ReplayButton.jsx)
//   clear()      화면을 떠날 때. 읽던 것을 멈추고 문장을 잊는다
//
// 듣는 화면(LISTENING)에는 읽을 문장이 없다. 앞 화면을 떠나면서 clear() 가 소리를 멈추므로 마이크에 안내 소리가 들어가지 않는다.
// 설정(settings/speechSettings.js)은 읽을 때마다 본다. 꺼져 있거나 브라우저가 읽지 못하면 조용히 넘어간다.
// 글은 넘기기 직전에 view/speechText.js 의 spoken 으로 다듬는다.

import { speaker as defaultSpeaker } from '../devices/speaker.js'
import { readSpeech, rateValue } from '../settings/speechSettings.js'
import { spoken } from '../view/speechText.js'

export function createVoiceGuide({ speaker = defaultSpeaker, read = readSpeech } = {}) {
  let lines = null
  let replayable = false
  const listeners = new Set()

  /** 지금 문장을 읽을 수 있는가: 문장이 있고, 설정이 켜져 있고, 브라우저가 읽을 수 있다 */
  const ready = () => Boolean(lines) && read().enabled && speaker.supported()

  function update() {
    const next = ready()
    if (next === replayable) return
    replayable = next
    for (const listener of listeners) listener()
  }

  function play() {
    if (!ready()) return false
    const settings = read()
    return speaker.speak(lines.map(spoken), { rate: rateValue(settings.rate), voiceURI: settings.voiceURI })
  }

  return {
    say(next) {
      const list = (next ?? []).filter(Boolean)
      lines = list.length ? list : null
      update()
      if (!play()) speaker.cancel()
    },
    replay() {
      update()
      return play()
    },
    clear() {
      lines = null
      speaker.cancel()
      update()
    },
    /** '다시 듣기' 버튼을 보일 수 있는가 (useSyncExternalStore 의 getSnapshot) */
    canReplay: () => replayable,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export const voiceGuide = createVoiceGuide()
