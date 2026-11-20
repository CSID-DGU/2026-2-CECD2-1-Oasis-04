// view/routeFit.js: 타임라인 줄이기 단계 고르기 (디자인 문서 9-1절 R2, 시안 fitTimeline 과 같은 순서)
import { describe, it, expect } from 'vitest'
import { FIT_START, nextFit, smallNames } from '../routeFit.js'

/** overflow 결과를 차례로 넣어 끝까지 돌린다 */
function run(overflows, opts = {}) {
  let fit = FIT_START
  let i = 0
  for (;;) {
    const next = nextFit(fit, { overflow: overflows[Math.min(i, overflows.length - 1)], ...opts })
    if (!next) return fit
    fit = next
    i += 1
  }
}

describe('nextFit (R2)', () => {
  it('넘치지 않으면 기본 그대로', () => {
    expect(run([false], { canFold: true })).toMatchObject({ level: 1, compact: false, maxLines: 2, steps: [] })
  })
  it('촘촘하게로 들어가면 거기서 멈춘다', () => {
    expect(run([true, false]).steps).toEqual(['촘촘'])
  })
  it('계속 넘치면 촘촘 → 걷기 한 줄 → 이름 36px → 가운데 접기', () => {
    expect(run([true], { canFold: true })).toMatchObject({ level: 4, compact: true, maxLines: 1, steps: ['촘촘', '걷기 한 줄', '이름 36px', '가운데 접기'] })
  })
  it('탈것이 2개 이하면 접지 않는다', () => {
    expect(run([true], { canFold: false }).steps).toEqual(['촘촘', '걷기 한 줄', '이름 36px'])
  })
  it('환승 2회 이하 경로가 없으면(fallback) 넘치지 않아도 접는다', () => {
    expect(run([false], { fallback: true, canFold: true })).toMatchObject({ level: 4, compact: false, steps: ['가운데 접기'] })
    expect(run([true, false], { fallback: true, canFold: true }).steps).toEqual(['촘촘', '가운데 접기'])
  })
})

describe('smallNames', () => {
  it('maxLines 줄을 넘는 이름만 36px', () => {
    expect(smallNames([1, 2, 3], 2)).toEqual([false, false, true])
    expect(smallNames([1, 2, 3], 1)).toEqual([false, true, true])
    expect(smallNames(null, 1)).toEqual([])
  })
})
