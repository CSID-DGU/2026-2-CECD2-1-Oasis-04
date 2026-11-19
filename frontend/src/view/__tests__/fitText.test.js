import { describe, it, expect } from 'vitest'
import { fitSize } from '../fitText.js'

const tokens = { start: 112, min: 72, step: 8 }

describe('fitSize', () => {
  it('들어가면 시작 크기 그대로', () => {
    expect(fitSize({ ...tokens, fits: () => true })).toBe(112)
  })
  it('넘치면 8 씩 줄여 처음 들어가는 크기', () => {
    expect(fitSize({ ...tokens, fits: (s) => s <= 96 })).toBe(96)
  })
  it('끝까지 넘치면 최소 72 에서 멈춘다', () => {
    const tried = []
    expect(fitSize({ ...tokens, fits: (s) => (tried.push(s), false) })).toBe(72)
    expect(tried).toEqual([112, 104, 96, 88, 80])
  })
})
