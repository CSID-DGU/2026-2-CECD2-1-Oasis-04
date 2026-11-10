// LISTENING: 2 듣는 중. 다 말했어요 / 취소 / 처음으로 (계획서 3절, 2-5절 'LISTENING 책임 분리').
//
// 이 화면의 책임은 세 가지뿐이다.
//   1. 텍스트 입력창을 음성 대신 보여 준다 (mock 마이크). 입력이 바뀔 때마다 recorder.onInput(text) 로 알린다.
//      → 무발화·무음 타이머는 recorder 가 관리하고, 만료되면 LISTENING 핸들러(effect)가 SPEECH_END 를 보낸다.
//   2. '다 말했어요' 는 타이머를 기다리지 않고 화면이 직접 SPEECH_END({ text }) 를 보낸다.
//   3. '취소' → LISTEN_CANCEL. '처음으로'(GO_HOME) 는 ScreenFrame 의 showHome 이 그린다. 둘 다 IDLE 로 가고 failCount 를 0 으로 만든다.
// recorder.start / stop 은 이 화면이 아니라 LISTENING 핸들러가 부른다 (Phase 4 3번).
// 먼저 끝나는 쪽이 SPEECH_END 를 보내면 상태가 바뀌어 cleanup 이 recorder.stop() 을 하므로 나머지는 무효가 된다.

import { useState } from 'react'
import ScreenFrame from '../components/ScreenFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { recorder } from '../devices/recorder.js'
import { config } from '../config.js'

const toSeconds = (ms) => (ms / 1000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })

export default function ListeningScreen() {
  const { dispatch } = useKiosk()
  // 입력창 내용은 이 화면만 쓰는 임시값이라 reducer 가 아니라 로컬 state 에 둔다.
  // SPEECH_END 가 나가는 순간에만 reducer 의 transcript 로 올라간다.
  const [text, setText] = useState('')

  const onChange = (e) => {
    const next = e.target.value
    setText(next)
    recorder.onInput(next) // 장치에 "지금 말하는 중" 을 알린다 (무발화 타이머 해제, 무음 타이머 리셋)
  }

  return (
    <ScreenFrame
      title={STATES.LISTENING}
      showHome
      actions={
        <>
          <button type="button" onClick={() => dispatch({ type: EVENTS.SPEECH_END, text })}>
            다 말했어요
          </button>
          <button type="button" onClick={() => dispatch({ type: EVENTS.LISTEN_CANCEL })}>
            취소
          </button>
        </>
      }
    >
      <p>듣고 있어요</p>

      <label>
        <span>말씀 대신 글로 입력 (mock 마이크)</span>
        <br />
        <input
          type="text"
          value={text}
          onChange={onChange}
          // 화면이 열리면 바로 타이핑할 수 있게 커서를 둔다. 상태가 LISTENING 으로 바뀔 때마다 새로 마운트되므로 매번 적용된다.
          autoFocus
          placeholder="예: 서울역 / 병원 / 웅얼 / 하와이 / 에러"
          aria-label="말씀 대신 글로 입력"
        />
      </label>
      <p style={{ fontSize: '0.8em', opacity: 0.7 }}>
        (개발용) 아무 입력 없이 {toSeconds(config.noSpeechMs)}초가 지나거나, 입력을 멈추고{' '}
        {toSeconds(config.silenceMs)}초가 지나면 자동으로 넘어가요
      </p>
    </ScreenFrame>
  )
}
