// 화면 제목 14개. 상태 하나 = 제목 하나 (화면은 ScreenFrame 의 title 로 받는다).
// 상태 이름(STATES.IDLE 같은 문자열)은 DevPanel 에만 보이고, 사용자 화면에는 이 문구만 보인다.
// 한 곳에 모아 둔 이유: 문구를 다듬거나 다국어로 바꿀 때 이 파일만 보면 되고,
// "STATES 14개 = 제목 14개" 를 테스트(__tests__/titles.test.js)로 셀 수 있다.
// 규칙: 한 줄, 존댓말, 질문("~시나요?") 또는 "~해 주세요" / "~이에요" 꼴. 말줄임표(…)는 쓰지 않는다.

import { STATES } from '../state/states.js'

export const SCREEN_TITLES = Object.freeze({
  // 판단 노드 (잠깐 지나가는 화면)
  [STATES.STARTUP_CHECK]: '준비하고 있어요',
  [STATES.FAIL_COUNT_CHECK]: '잠시만요',

  // 화면 상태
  [STATES.CHECKING]: '잠시만 기다려 주세요',
  [STATES.IDLE]: '어디로 가시나요?',
  [STATES.IDLE_REDUCED]: '어디로 가시나요?',
  [STATES.LISTENING]: '말씀해 주세요',
  [STATES.RESOLVING]: '말씀을 알아듣는 중이에요',
  [STATES.ROUTING]: '가는 길을 찾고 있어요',
  [STATES.CONFIRMING]: '가실 곳을 확인해 주세요',
  [STATES.ROUTE_GUIDE]: '이렇게 가세요',
  [STATES.QR_HANDOFF]: '휴대폰으로 보내 드릴게요',
  [STATES.REASKING]: '다시 한번 말씀해 주세요',
  [STATES.MANUAL_SELECT]: '가실 곳을 골라 주세요',
  [STATES.UNAVAILABLE]: '안내해 드릴 수 없어요',
})
