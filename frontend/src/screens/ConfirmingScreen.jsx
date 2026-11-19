// CONFIRMING: 4 목적지 확인 (계획서 3절). 자동 녹음 없음 (회의 확정). 버튼으로만 진행한다.
// 무입력 60초(INACTIVITY_TIMEOUT)는 effect 담당 (Phase 4 5번).
//
// 보여 주는 데이터는 reducer 의 state.resolve (RESOLVING 핸들러가 RESOLVE_NEED_CONFIRM 에 담아 준 /resolve 응답).
//   후보 1개    → "“OO” 맞나요?" + 분류 + '예' 주 버튼 (왼쪽 칸 안, 디자인 문서 2절 예외)
//   후보 여러 개 → "가시려는 곳을 하나 골라 주세요" + 고르는 카드 1열
//   후보 0개    → 안내 문구만 (정상 흐름에선 오지 않는다. DevPanel 로 payload 없이 들어온 경우)
// 어느 후보를 누르든 DESTINATION_CONFIRMED({ poi }) → reducer 가 selectedPoi 에 저장 → ROUTING.
// 오른쪽 칸: '모두 아니에요'(CONFIRM_NONE_OF_THEM, failCount +1), '다른 곳 말하기'(CONFIRM_SAY_OTHER_PLACE),
//            '처음으로'(GO_HOME, FlowFrame 의 showHome 이 그린다)
// 모양: 확정 시안 confirming-final.html, 디자인 문서 11-1·11-2절. 위치·크기는 ConfirmingScreen.css

import FlowFrame from '../components/FlowFrame.jsx'
import PrimaryButton from '../components/PrimaryButton.jsx'
import SecondaryButton from '../components/SecondaryButton.jsx'
import HeardLine from '../components/HeardLine.jsx'
import PickList from '../components/PickList.jsx'
import PickCard from '../components/PickCard.jsx'
import { useKiosk } from '../state/KioskContext.jsx'
import { STATES } from '../state/states.js'
import { EVENTS } from '../state/events.js'
import { SCREEN_TITLES } from './titles.js'
import './ConfirmingScreen.css'

/** /resolve 응답에서 후보 목록을 꺼낸다. candidates 가 없고 poi 만 있으면 그것을 유일한 후보로 본다. */
function candidatesOf(resolve) {
  if (Array.isArray(resolve?.candidates) && resolve.candidates.length > 0) return resolve.candidates
  if (resolve?.poi) return [resolve.poi]
  return []
}

function OneCandidate({ poi, onConfirm }) {
  return (
    <div className="confirm-choose">
      <p className="confirm-ask">“{poi.name}” 맞나요?</p>
      {poi.category && <p className="confirm-ask-kind">{poi.category}</p>}
      <div className="confirm-yes">
        <PrimaryButton icon="check" onClick={onConfirm}>
          예
        </PrimaryButton>
      </div>
    </div>
  )
}

function ManyCandidates({ candidates, onConfirm }) {
  return (
    <div className="confirm-choose">
      <p className="confirm-lead">가시려는 곳을 하나 골라 주세요</p>
      <PickList variant="confirm">
        {candidates.map((poi) => (
          // key: React 가 목록의 각 항목을 구분하는 이름표. 서버가 준 고유 id 를 쓴다 (인덱스 X).
          <PickCard key={poi.id} name={poi.name} kind={poi.category} onClick={() => onConfirm(poi)} />
        ))}
      </PickList>
    </div>
  )
}

export default function ConfirmingScreen() {
  const { state, dispatch } = useKiosk()
  const candidates = candidatesOf(state.resolve)
  const confirm = (poi) => dispatch({ type: EVENTS.DESTINATION_CONFIRMED, poi })
  // 실제 마이크에서는 reducer 의 transcript 가 비어 있다 (글자를 아는 것은 서버뿐). 서버가 해석한 문장을 대신 보여 준다
  const heard = state.transcript || state.resolve?.transcript

  return (
    <FlowFrame
      showHome
      left={
        <div className="confirm">
          <h1 className="confirm-title">{SCREEN_TITLES[STATES.CONFIRMING]}</h1>
          <HeardLine text={heard} />
          {candidates.length === 0 && (
            <div className="confirm-choose">
              <p className="confirm-lead">후보 목적지를 찾지 못했어요</p>
            </div>
          )}
          {candidates.length === 1 && <OneCandidate poi={candidates[0]} onConfirm={() => confirm(candidates[0])} />}
          {candidates.length > 1 && <ManyCandidates candidates={candidates} onConfirm={confirm} />}
        </div>
      }
      actions={
        <>
          <SecondaryButton icon="close" onClick={() => dispatch({ type: EVENTS.CONFIRM_NONE_OF_THEM })}>
            모두 아니에요
          </SecondaryButton>
          <SecondaryButton icon="mic" onClick={() => dispatch({ type: EVENTS.CONFIRM_SAY_OTHER_PLACE })}>
            다른 곳 말하기
          </SecondaryButton>
        </>
      }
    />
  )
}
