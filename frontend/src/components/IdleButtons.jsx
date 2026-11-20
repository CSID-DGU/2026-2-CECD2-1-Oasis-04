// 첫 화면의 버튼 묶음 (디자인 문서 8-2절, 시안 idle-final.css 의 .v8-actions .v8-mic .v9-hand-big).
//   voice true   주 버튼 '말하기'(큰 마이크 + 퍼지는 고리) + 보조 버튼 '손으로 고르기'   — IDLE
//   voice false  주 버튼 '손으로 고르기'(큰 손가락) 하나. 마이크와 고리는 없다           — IDLE_REDUCED
// 버튼이 dispatch 하는 이벤트는 화면이 정해서 넘긴다 (onSpeak, onManual)

import Icon from './Icon.jsx'
import './IdleButtons.css'

export default function IdleButtons({ voice, onSpeak, onManual }) {
  if (!voice) {
    return (
      <div className="idle-actions">
        <button type="button" className="btn btn-primary" onClick={onManual}>
          <Icon name="touch_app" className="idle-big-icon" />
          <span>손으로 고르기</span>
        </button>
      </div>
    )
  }
  return (
    <div className="idle-actions">
      <button type="button" className="btn btn-primary" onClick={onSpeak}>
        <span className="idle-mic">
          <Icon name="mic" className="idle-big-icon" />
        </span>
        <span>말하기</span>
      </button>
      <button type="button" className="btn btn-secondary" onClick={onManual}>
        <Icon name="touch_app" className="idle-hand" />
        <span>손으로 고르기</span>
      </button>
    </div>
  )
}
