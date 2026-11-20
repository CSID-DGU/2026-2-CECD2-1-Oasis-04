import { describe, it, expect } from 'vitest'
import { FALL_MS, FULL_RMS, NOISE_GATE, RISE_MS, barAmount, fakeVoice, followLevel, rmsToLevel } from '../voiceLevel.js'

describe('rmsToLevel (잡음 무시, 최대값)', () => {
  it('잡음 기준 이하·잘못된 값은 0', () => {
    expect(rmsToLevel(0)).toBe(0)
    expect(rmsToLevel(NOISE_GATE)).toBe(0)
    expect(rmsToLevel(0.01)).toBe(0)
    expect(rmsToLevel(null)).toBe(0)
    expect(rmsToLevel(NaN)).toBe(0)
  })
  it('최대 RMS 이상은 1 에서 멈춘다', () => {
    expect(rmsToLevel(FULL_RMS)).toBe(1)
    expect(rmsToLevel(1)).toBe(1)
  })
  it('사이 값은 0~1 이고 클수록 크다', () => {
    const a = rmsToLevel(0.05)
    const b = rmsToLevel(0.1)
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(a)
    expect(b).toBeLessThan(1)
  })
})

describe('followLevel (빨리 올라가고 천천히 내려옴)', () => {
  it('한 프레임(16ms)에 올라가는 양이 내려가는 양보다 크다', () => {
    const up = followLevel(0, 1, 16)
    const down = 1 - followLevel(1, 0, 16)
    expect(up).toBeGreaterThan(down * 3)
  })
  it('시간 상수만큼 지나면 약 63% 따라간다', () => {
    expect(followLevel(0, 1, RISE_MS)).toBeCloseTo(1 - Math.exp(-1), 5)
    expect(followLevel(1, 0, 200)).toBeCloseTo(Math.exp(-200 / FALL_MS), 5)
  })
  it('0~1 밖으로 나가지 않고, 긴 간격(탭 숨김)은 잘라 한 번에 튀지 않는다', () => {
    expect(followLevel(0, 5, 16)).toBeLessThanOrEqual(1)
    expect(followLevel(1, 0, 100000)).toBeCloseTo(followLevel(1, 0, 250), 10)
    expect(followLevel(0.5, 0.5, 16)).toBe(0.5)
    expect(followLevel(0.5, 0, -10)).toBe(0.5)
  })
})

describe('barAmount / fakeVoice (시안 그대로)', () => {
  it('조용하면 0.06, 가장 커도 1 을 넘지 않는다', () => {
    expect(barAmount(0, 3, 1.2)).toBeCloseTo(0.06, 10)
    for (let side = 0; side <= 20; side++) {
      for (let t = 0; t < 3; t += 0.37) expect(barAmount(1, side, t)).toBeLessThanOrEqual(1)
    }
  })
  it('멈춘 그림 시각(0.6초)의 가짜 음량은 시안과 같은 값', () => {
    const phrase = Math.max(0, Math.sin((Math.PI * 2 * 0.6) / 2.6)) ** 0.55
    expect(fakeVoice(0.6)).toBeCloseTo(phrase * (0.8 + 0.2 * Math.sin(Math.PI * 2 * 0.9 * 0.6 - 1.8)), 12)
    expect(fakeVoice(1.3)).toBeCloseTo(0, 5) // 말 한 마디 사이 쉼
  })
})
