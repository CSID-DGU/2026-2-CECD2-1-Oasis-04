// 무입력 남은 초 계산 (디자인 문서 11-4절). 화면 모양은 스크린샷으로 확인한다.
import { describe, it, expect } from 'vitest'
import { secondsLeftOf, NOTICE_SECONDS } from '../useInactivityCountdown.js'

describe('secondsLeftOf', () => {
  it('무입력 타이머가 없으면 null', () => {
    expect(secondsLeftOf(null, 1000)).toBeNull()
  })
  it('남은 시간을 초로 올림한다 (14.2초 남으면 15)', () => {
    expect(secondsLeftOf(15000, 800)).toBe(15)
    expect(secondsLeftOf(15000, 1000)).toBe(14)
  })
  it('마감이 지나면 0 에서 멈춘다', () => {
    expect(secondsLeftOf(1000, 5000)).toBe(0)
  })
  it('알림은 15초 이하일 때 보인다', () => {
    expect(NOTICE_SECONDS).toBe(15)
  })
})
