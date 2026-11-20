// LISTENING: 듣는 중. 다 말했어요 / 취소 / 처음으로 (계획서 3절, 2-5절 'LISTENING 책임 분리').
// 모양: 확정 시안 design/mockups/confirmed/listening-final.html, 디자인 문서 10-1절.
//   왼쪽 칸  듣는 중 표시(고리 + 마이크 + 음량 막대) → "듣고 있어요" → 안내 두 줄. 한 덩어리로 세로 가운데
//   오른쪽 칸 다 말했어요(주) / 취소 / 처음으로
// 화면 제목(titles.js 의 "말씀해 주세요")은 쓰지 않는다. "듣고 있어요"와 뜻이 겹쳐서 "듣고 있어요"가 제목 역할을 한다 (10-1절).
//
// 이 화면의 책임
//   1. '다 말했어요' 는 타이머를 기다리지 않고 화면이 직접 SPEECH_END({ text }) 를 보낸다.
//      text 는 recorder 가 들고 있는 글이다 (mock: DevPanel 에 넣은 글, real: 빈 글 — 말소리는 녹음으로 넘어간다)
//   2. '취소' → LISTEN_CANCEL. '처음으로'(GO_HOME) 는 FlowFrame 의 showHome 이 그린다. 둘 다 IDLE 로 가고 failCount 를 0 으로 만든다.
// mock 마이크의 글 입력창은 DevPanel 로 옮겼다 (계획서 4-2절. 시안에 입력창이 없다). DevPanel 이 recorder.onInput 을 부르고,
// 무발화·무음 타이머는 예전처럼 recorder 가 관리한다. recorder.start / stop 은 LISTENING 핸들러가 부른다.
// 음량 막대는 VoiceMeter 가 프레임마다 recorder.getLevel() 을 읽어 그린다 (React 상태를 거치지 않는다, 12단계).

import FlowFrame from '../components/FlowFrame.jsx'
import PrimaryButton from '../components/PrimaryButton.jsx'
import SecondaryButton from '../components/SecondaryButton.jsx'
import VoiceMeter from '../components/VoiceMeter.jsx'
import Ring from '../components/Ring.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { EVENTS } from '../state/events.js'
import { recorder } from '../devices/recorder.js'
import './ListeningScreen.css'

export default function ListeningScreen() {
  const { dispatch } = useKiosk()

  return (
    <FlowFrame
      showHome
      left={
        <div className="listening">
          <VoiceMeter readLevel={recorder.getLevel}>
            <Ring icon="mic" />
          </VoiceMeter>
          <h1 className="listening-core">듣고 있어요</h1>
          <p className="listening-hint">
            가실 곳을 말씀해 주세요.
            <br />
            말씀이 끝나면 자동으로 넘어가요
          </p>
        </div>
      }
      actions={
        <>
          <PrimaryButton icon="check" onClick={() => dispatch({ type: EVENTS.SPEECH_END, text: recorder.getText() })}>
            다 말했어요
          </PrimaryButton>
          <SecondaryButton icon="close" onClick={() => dispatch({ type: EVENTS.LISTEN_CANCEL })}>
            취소
          </SecondaryButton>
        </>
      }
    />
  )
}
