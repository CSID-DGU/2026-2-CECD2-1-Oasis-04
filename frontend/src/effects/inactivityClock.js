// 무입력 마감 시각을 적어 두는 작은 저장소 (계획서 4-2절). reducer 밖에 둔다 (새 이벤트 없음).
// 타이머는 여전히 inactivity 핸들러 하나만 건다. 핸들러가 타이머를 걸 때 마감 시각을 적고, 지울 때 null 로 비운다.
// 화면은 hooks/useInactivityCountdown.js 로 읽는다 (useSyncExternalStore 로 구독).
//
// 두 곳에서 따로 세면 화면 숫자와 실제 IDLE 복귀가 어긋나므로, 화면은 "마감 − 지금" 만 계산한다.

let deadline = null
const listeners = new Set()

export function getInactivityDeadline() {
  return deadline
}

/** 마감 시각(ms, Date.now 기준)을 적는다. null 이면 무입력 타이머가 없다는 뜻 */
export function setInactivityDeadline(value) {
  if (deadline === value) return
  deadline = value
  for (const fn of listeners) fn()
}

export function subscribeInactivityDeadline(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
