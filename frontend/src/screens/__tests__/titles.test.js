// 화면 문구 테스트.
//   - SCREEN_TITLES: STATES 14개와 제목 14개가 1:1 로 맞는지 (빠진 상태·남는 제목이 없는지), 문구 규칙(존댓말, 말줄임표 없음)
//   - toDisplayMessage: 오류 코드는 공통 문구로, 문장은 그대로 (UNAVAILABLE 화면 표시용. reducer 와 무관)

import { describe, it, expect } from 'vitest'
import { STATES } from '../../state/states.js'
import { SCREEN_TITLES } from '../titles.js'
import { toDisplayMessage, isErrorCode, GENERIC_ERROR_MESSAGE } from '../errorMessage.js'

describe('SCREEN_TITLES', () => {
  const stateNames = Object.values(STATES)
  const titledStates = Object.keys(SCREEN_TITLES)

  it('STATES 14개마다 제목이 하나씩 있다', () => {
    expect(stateNames).toHaveLength(14)
    for (const state of stateNames) {
      expect(SCREEN_TITLES[state], `${state} 의 제목이 없다`).toBeTypeOf('string')
      expect(SCREEN_TITLES[state].trim().length, `${state} 의 제목이 비어 있다`).toBeGreaterThan(0)
    }
  })

  it('STATES 에 없는 상태의 제목은 없다 (제목도 정확히 14개)', () => {
    expect(titledStates).toHaveLength(14)
    for (const state of titledStates) {
      expect(stateNames, `${state} 는 STATES 에 없는 상태다`).toContain(state)
    }
  })

  it('제목은 상태 이름 그대로가 아니라 사람이 읽는 문구다', () => {
    for (const state of stateNames) {
      expect(SCREEN_TITLES[state]).not.toBe(state)
    }
  })

  it('제목은 한 줄이고 말줄임표를 쓰지 않는다', () => {
    for (const title of Object.values(SCREEN_TITLES)) {
      expect(title).not.toMatch(/\n/)
      expect(title).not.toMatch(/…|\.\.\./)
    }
  })

  it('제목은 존댓말로 끝난다 (~요 / ~세요 / ~나요?)', () => {
    for (const title of Object.values(SCREEN_TITLES)) {
      expect(title, `"${title}" 는 존댓말 어미가 아니다`).toMatch(/(요|요\?)$/)
    }
  })
})

describe('toDisplayMessage (UNAVAILABLE 표시용)', () => {
  it('대문자 오류 코드는 공통 문구로 바꾼다', () => {
    for (const code of ['STT_ERROR', 'SERVER_ERROR', 'ROUTE_ERROR', 'POIS_ERROR', 'E42']) {
      expect(isErrorCode(code)).toBe(true)
      expect(toDisplayMessage(code)).toBe(GENERIC_ERROR_MESSAGE)
    }
  })

  it('이미 문장이면 그대로 보여 준다', () => {
    for (const sentence of ['경로를 찾지 못했어요', '안내할 수 없는 곳이에요', '범위 밖 (DevPanel)', 'Not implemented: realRecorder.start']) {
      expect(isErrorCode(sentence)).toBe(false)
      expect(toDisplayMessage(sentence)).toBe(sentence)
    }
  })

  it('값이 없으면 공통 문구를 보여 준다', () => {
    expect(toDisplayMessage(null)).toBe(GENERIC_ERROR_MESSAGE)
    expect(toDisplayMessage(undefined)).toBe(GENERIC_ERROR_MESSAGE)
    expect(toDisplayMessage('')).toBe(GENERIC_ERROR_MESSAGE)
    expect(toDisplayMessage('   ')).toBe(GENERIC_ERROR_MESSAGE)
  })
})
