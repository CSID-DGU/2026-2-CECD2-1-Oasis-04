// 띠의 날짜·시각 글자가 시안(design/mockups/shared/v3.js 의 tick)과 같은 모양인지
import { describe, it, expect } from 'vitest'
import { formatDate, formatTime } from '../Clock.jsx'

describe('Clock 글자', () => {
  it('날짜는 "11월 19일 목요일"', () => {
    expect(formatDate(new Date('2026-11-19T14:30:00'))).toBe('11월 19일 목요일')
  })
  it('시각은 오전/오후 12시간제, 분은 두 자리', () => {
    expect(formatTime(new Date('2026-11-19T14:30:00'))).toBe('오후 2:30')
    expect(formatTime(new Date('2026-11-19T00:05:00'))).toBe('오전 12:05')
    expect(formatTime(new Date('2026-11-19T12:00:00'))).toBe('오후 12:00')
    expect(formatTime(new Date('2026-11-19T09:07:00'))).toBe('오전 9:07')
  })
})
