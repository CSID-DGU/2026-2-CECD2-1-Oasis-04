import { describe, it, expect } from 'vitest'
import { countdownView } from '../useCountdown.js'

describe('countdownView', () => {
  it('처음에는 남은 초 전부, 호 가득', () => {
    expect(countdownView(3000, 3000, false)).toEqual({ seconds: 3, progress: 1 })
  })
  it('보통은 호가 매끄럽게 줄고 숫자는 올림', () => {
    expect(countdownView(3000, 1800, false)).toEqual({ seconds: 2, progress: 0.6 })
  })
  it('움직임 줄이기는 호도 1초 단위', () => {
    expect(countdownView(3000, 1800, true)).toEqual({ seconds: 2, progress: 2 / 3 })
  })
  it('마감이 지나면 0', () => {
    expect(countdownView(3000, -50, false)).toEqual({ seconds: 0, progress: 0 })
  })
})
