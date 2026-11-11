// FAIL_COUNT_CHECK 진입 시 실행되는 effect 핸들러 (계획서 2-5절 표, 6절 6번 확정).
// 판단 노드라서 API 호출 없이 reducer 의 failCount 만 보고 바로 다음 이벤트를 낸다.
//   failCount === 1 → FAIL_COUNT_1 (REASKING)
//   failCount >= 2  → FAIL_COUNT_2 (MANUAL_SELECT)
// failCount 는 reducer 가 RESOLVE_NOT_UNDERSTOOD / CONFIRM_NONE_OF_THEM 에서 이미 +1 해 둔 값이다.
//
// 동기 판단인데도 dispatch 를 setTimeout(…, 0) 으로 한 틱 미루는 이유 (StrictMode 대응):
//   React 개발 모드의 StrictMode 는 effect 를 "실행 → cleanup → 다시 실행" 으로 두 번 돌린다.
//   effect 본문에서 바로 dispatch 하면 1차 실행이 이미 이벤트를 보낸 뒤라 cleanup 으로 되돌릴 수 없고,
//   2차 실행이 같은 이벤트를 한 번 더 보낸다. 두 번째 dispatch 는 이미 REASKING/MANUAL_SELECT 로 바뀐 상태에서
//   오므로 "표에 없는 전이" 경고가 뜬다. (실제 상태 전이는 안 일어나지만 경고가 나면 안 된다.)
//   dispatch 를 타이머에 걸어 두면 1차 실행의 타이머는 곧바로 이어지는 cleanup 의 clearTimeout 으로 지워지고,
//   2차 실행의 타이머 하나만 살아남아 이벤트는 정확히 한 번 나간다. checking.js / idleReduced.js 와 같은 패턴이다.

import { EVENTS } from '../../state/events.js'

export function failCountCheckHandler(state, dispatch) {
  const { failCount } = state

  let type
  if (failCount >= 2) {
    type = EVENTS.FAIL_COUNT_2
  } else {
    if (failCount < 1) {
      // 여기 오려면 반드시 +1 이벤트를 거쳤어야 하므로 0 은 불변식이 깨진 것이다.
      // 상태 머신을 멈추지 않도록 1회 실패(REASKING)로 취급하고 경고만 남긴다.
      console.warn(`[failCountCheck] failCount 가 ${failCount} 인 채로 FAIL_COUNT_CHECK 에 들어왔다 → FAIL_COUNT_1 로 처리`)
    }
    type = EVENTS.FAIL_COUNT_1
  }

  const timer = setTimeout(() => {
    dispatch({ type })
  }, 0)

  return () => {
    clearTimeout(timer)
  }
}
