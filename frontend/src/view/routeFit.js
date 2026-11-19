// 타임라인 줄이기 단계 고르기 (디자인 문서 9-1절 R2, 시안 route-guide-final.html 의 fitTimeline). React 없이 테스트한다.
// 넘치는지는 그려 봐야 알 수 있으므로 Timeline 부품이 그리고 재서 이 함수에 넘긴다. 이 파일은 "다음에 무엇을 해 볼지"만 정한다.
//
// 단계 (시안과 같은 순서. 앞 단계로 넘치지 않으면 거기서 멈춘다)
//   0 기본           level 1(모든 점), 두 줄 넘는 이름만 36px
//   1 촘촘           ① 갈아타는 곳 라벨을 빼고 간격을 줄인다
//   2 걷기 한 줄     ② 걸어서 갈아타는 곳을 한 줄로 (level 2)
//   3 이름 36px      ③ 두 줄 이름도 36px
//   4 가운데 접기    ④ 첫 구간과 마지막 구간만 (level 4). 탈것이 3개 이상일 때만. 환승 2회 이하 경로가 없을 때(fallback)는 넘치지 않아도 접는다

export const FIT_START = Object.freeze({ phase: 0, level: 1, compact: false, maxLines: 2, steps: Object.freeze([]) })

/** 단계 level → routeView 의 타임라인 목록 이름 (toRouteView 의 view.timeline) */
export const TIMELINE_OF_LEVEL = Object.freeze({ 1: 'full', 2: 'merged', 4: 'folded' })

/**
 * 지금 단계로 그려 본 결과 → 다음 단계. 더 할 것이 없으면 null (이 단계로 끝)
 *   overflow  지금 단계로 그렸을 때 칸을 넘치는지
 *   fallback  환승 2회 이하 경로가 없어 하나만 보이는 경우 (R1)
 *   canFold   가운데를 접을 수 있는지 (탈것 3개 이상, routeView 의 timeline.folded 가 있음)
 */
export function nextFit(fit, { overflow, fallback = false, canFold = false }) {
  const step = (name, change) => ({ ...fit, ...change, steps: [...fit.steps, name] })
  const fold = () => ((overflow || fallback) && canFold ? step('가운데 접기', { phase: 4, level: 4, maxLines: 1 }) : null)
  switch (fit.phase) {
    case 0:
      return overflow ? step('촘촘', { phase: 1, compact: true }) : fold()
    case 1:
      return overflow ? step('걷기 한 줄', { phase: 2, level: 2 }) : fold()
    case 2:
      return overflow ? step('이름 36px', { phase: 3, maxLines: 1 }) : fold()
    case 3:
      return fold()
    default:
      return null
  }
}

/** 이름마다 줄 수(48px 로 그렸을 때) → 36px 로 줄일 이름인지. maxLines 줄을 넘으면 줄인다 (시안 fitNames) */
export function smallNames(lines, maxLines) {
  return (lines ?? []).map((n) => n > maxLines)
}
