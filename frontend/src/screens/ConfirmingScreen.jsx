// CONFIRMING: 4 목적지 확인 (계획서 3절). 자동 녹음 없음 (회의 확정). 버튼으로만 진행한다.
// 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당 (Phase 4 5번).
//
// 보여 주는 데이터는 reducer 의 state.resolve (RESOLVING 핸들러가 RESOLVE_NEED_CONFIRM 에 담아 준 /resolve 응답).
//   후보 1개  → "OO 맞나요?" + '예'
//   후보 여러 개 → "가시려는 곳을 하나 골라 주세요" + 후보마다 큰 버튼
//   후보 0개  → 안내 문구만 (정상 흐름에선 오지 않는다. DevPanel 로 payload 없이 들어온 경우)
// 어느 후보를 누르든 DESTINATION_CONFIRMED({ poi }) → reducer 가 selectedPoi 에 저장 → ROUTING.
// 그 밖에 '모두 아니에요'(CONFIRM_NONE_OF_THEM, failCount +1), '다른 곳 말하기'(CONFIRM_SAY_OTHER_PLACE).
// '처음으로'(GO_HOME) 는 ScreenFrame 의 showHome 이 그린다.

import ScreenFrame from '../components/ScreenFrame.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { SCREEN_TITLES } from './titles.js'

/** /resolve 응답에서 후보 목록을 꺼낸다. candidates 가 없고 poi 만 있으면 그것을 유일한 후보로 본다. */
function candidatesOf(resolve) {
  if (Array.isArray(resolve?.candidates) && resolve.candidates.length > 0) return resolve.candidates
  if (resolve?.poi) return [resolve.poi]
  return []
}

export default function ConfirmingScreen() {
  const { state, dispatch } = useKiosk()
  const candidates = candidatesOf(state.resolve)
  const confirm = (poi) => dispatch({ type: EVENTS.DESTINATION_CONFIRMED, poi })
  // 실제 마이크에서는 reducer 의 transcript 가 비어 있다 (글자를 아는 것은 서버뿐). 서버가 해석한 문장을 대신 보여 준다
  const heard = state.transcript || state.resolve?.transcript

  return (
    <ScreenFrame
      title={SCREEN_TITLES[STATES.CONFIRMING]}
      showHome
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: EVENTS.CONFIRM_NONE_OF_THEM })}>
            모두 아니에요
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: EVENTS.CONFIRM_SAY_OTHER_PLACE })}>
            다른 곳 말하기
          </button>
        </>
      }
    >
      {heard && <p>들은 말: "{heard}"</p>}

      {candidates.length === 0 && <p>후보 목적지를 찾지 못했어요</p>}

      {candidates.length === 1 && (
        <>
          <p>
            "{candidates[0].name}" 맞나요?
            {candidates[0].category && <small> ({candidates[0].category})</small>}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => confirm(candidates[0])}>
            예
          </button>
        </>
      )}

      {candidates.length > 1 && (
        <>
          <p>가시려는 곳을 하나 골라 주세요</p>
          <ul className="btn-list">
            {candidates.map((poi) => (
              // key: React 가 목록의 각 항목을 구분하는 이름표. 서버가 준 고유 id 를 쓴다 (인덱스 X).
              <li key={poi.id}>
                <button type="button" className="btn btn-primary" onClick={() => confirm(poi)}>
                  {poi.name}
                  {poi.category && <small> ({poi.category})</small>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </ScreenFrame>
  )
}
