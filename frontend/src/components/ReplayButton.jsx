// '다시 듣기': 지금 화면의 음성 안내를 처음부터 다시 읽는다 (effects/voiceGuide.js 의 replay).
// 얇은 띠(ThinBand)의 서비스 이름 옆에 둔다. 읽을 문장이 있는 화면에서만 보이고,
// 음성 안내가 꺼져 있거나 브라우저가 읽지 못하면 보이지 않는다.
// 자리와 모양은 임시다. 확정 시안에 이 버튼이 없어서 화면 배치를 건드리지 않는 띠에 두었다 (docs/team-requests.md #19).

import { useSyncExternalStore } from 'react'
import Icon from './Icon.jsx'
import { voiceGuide } from '../effects/voiceGuide.js'
import './ReplayButton.css'

export default function ReplayButton({ guide = voiceGuide }) {
  const canReplay = useSyncExternalStore(guide.subscribe, guide.canReplay, () => false)
  if (!canReplay) return null
  return (
    <button type="button" className="replay-button" onClick={() => guide.replay()}>
      <Icon name="volume_up" className="replay-button-icon" />
      <span>다시 듣기</span>
    </button>
  )
}
