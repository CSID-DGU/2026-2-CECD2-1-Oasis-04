import { describe, it, expect } from 'vitest'
import { reasonOf, splitFirstSentence, GENERIC_ERROR_MESSAGE } from '../unavailableReason.js'
import { hasSpace, evenWrapClass } from '../textWrap.js'

describe('reasonOf', () => {
  it('코드마다 그림이 정해져 있다 (12-3절)', () => {
    const icons = Object.fromEntries(
      ['NO_ROUTE', 'TOO_CLOSE', 'OUT_OF_SCOPE', 'UPSTREAM', 'NO_POI', 'UNKNOWN'].map((code) => [code, reasonOf({ code }).icon]),
    )
    expect(icons).toEqual({ NO_ROUTE: 'flag', TOO_CLOSE: 'walk', OUT_OF_SCOPE: 'pin', UPSTREAM: 'clock', NO_POI: 'clock', UNKNOWN: 'clock' })
  })
  it('서버 문장이 있으면 그 글자 그대로', () => {
    const message = '가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.'
    expect(reasonOf({ code: 'TOO_CLOSE', message }).text).toBe(message)
  })
  it('문장이 없거나 오류 코드 모양이면 코드별 기본 문구', () => {
    expect(reasonOf({ code: 'NO_ROUTE', message: null }).text).toBe('가는 길을 찾을 수 없어요')
    expect(reasonOf({ code: 'UNKNOWN', message: 'SERVER_TIMEOUT' }).text).toBe(GENERIC_ERROR_MESSAGE)
  })
  it('모르는 코드·null·예전 문자열은 UNKNOWN(시계)', () => {
    expect(reasonOf({ code: 'WHAT' })).toMatchObject({ code: 'UNKNOWN', icon: 'clock', text: GENERIC_ERROR_MESSAGE })
    expect(reasonOf(null).text).toBe(GENERIC_ERROR_MESSAGE)
    expect(reasonOf('ROUTE_ERROR').text).toBe(GENERIC_ERROR_MESSAGE)
    expect(reasonOf('말씀이 조금 길었어요. 짧게 한 번 더 말씀해 주세요.')).toMatchObject({ code: 'UNKNOWN', icon: 'clock' })
  })
})

describe('splitFirstSentence', () => {
  it('첫 ". " 뒤에서 나눈다', () => {
    expect(splitFirstSentence('가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.')).toEqual([
      '가까운 곳이라 걸어서 가실 수 있어요.',
      '약 300미터예요.',
    ])
  })
  it('없으면 전체가 첫 문장', () => {
    expect(splitFirstSentence('가는 길을 찾을 수 없어요')).toEqual(['가는 길을 찾을 수 없어요', ''])
    expect(splitFirstSentence('가까운 곳이라 걸어서 가실 수 있어요.')).toEqual(['가까운 곳이라 걸어서 가실 수 있어요.', ''])
  })
})

describe('textWrap', () => {
  it('띄어쓰기가 있으면 띄어쓰기에서만 바꾸는 클래스', () => {
    expect(hasSpace('국립현대미술관 서울관')).toBe(true)
    expect(hasSpace(' 동대문역사문화공원역 ')).toBe(false)
    expect(evenWrapClass('국립현대미술관 서울관')).toBe('wrap-even is-keep-all')
    expect(evenWrapClass('동대문역사문화공원역')).toBe('wrap-even')
  })
})
