// @vitest-environment jsdom
//
// IDLE, IDLE_REDUCED (7단계, 디자인 문서 8절): 큰 띠의 이름·정보 없음, 버튼 종류·개수와 dispatch 하는 이벤트.
// 띠의 측정(이름 줄이기, 번호 고르기)은 jsdom 에서 너비가 0 이라 보지 않는다. 그 규칙은 view/__tests__/placeBand.test.js 와 스크린샷으로 본다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { EVENTS } from '../../state/events.js'
import { withProviders } from './providers.jsx'
import { PLACES } from '../../api/mock/data/places.js'

let kiosk = { state: {}, dispatch: vi.fn() }
vi.mock('../../state/KioskContext.jsx', () => ({ useKiosk: () => kiosk }))

const { default: IdleScreen } = await import('../IdleScreen.jsx')
const { default: IdleReducedScreen } = await import('../IdleReducedScreen.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root

async function renderScreen(Screen, place) {
  kiosk = { state: {}, dispatch: vi.fn() }
  await act(async () => {
    root.render(withProviders(<Screen />, { location: { name: place?.name ?? '', place } }))
  })
  return {
    buttons: [...container.querySelectorAll('button')].map((b) => [b.className, b.textContent.trim()]),
    name: container.querySelector('.place-band-plate')?.textContent,
    text: container.textContent,
  }
}

describe('IDLE, IDLE_REDUCED', () => {
  beforeEach(() => {
    container = document.createElement('div')
    root = createRoot(container)
  })
  afterEach(() => act(() => root.unmount()))

  it('IDLE: 띠 이름은 끝의 "역" 을 떼고, 질문·예시 세 줄, 주 버튼 말하기 + 보조 버튼 손으로 고르기', async () => {
    const { buttons, name, text } = await renderScreen(IdleScreen, PLACES.subway)
    expect(name).toBe('종로3가')
    expect(text).toContain('어디로 가시나요?')
    expect(text).toContain('“명동 어떻게 가요?”“서울역 가는 버스”“가까운 병원”')
    expect(buttons).toEqual([
      ['btn btn-primary', '말하기'],
      ['btn btn-secondary', '손으로 고르기'],
    ])
    container.querySelector('.btn-primary').click()
    container.querySelector('.btn-secondary').click()
    expect(kiosk.dispatch.mock.calls.map(([e]) => e.type)).toEqual([EVENTS.MIC_BUTTON_PRESSED, EVENTS.MANUAL_SELECT_PRESSED])
  })

  it('버스정류장: 끝의 "정류장" 을 떼고 "버스 번호는 예시"', async () => {
    const { name, text } = await renderScreen(IdleScreen, PLACES.bus)
    expect(name).toBe('종로3가.탑골공원')
    expect(text).toContain('버스 번호는 예시')
  })

  it('정보 없음: "지금 계신 곳을 확인하고 있어요"', async () => {
    const { name } = await renderScreen(IdleScreen, null)
    expect(name).toBe('지금 계신 곳을 확인하고 있어요')
  })

  it('IDLE_REDUCED: 안내 문장과 주 버튼 손으로 고르기 하나', async () => {
    const { buttons, text } = await renderScreen(IdleReducedScreen, PLACES.subway)
    expect(text).toContain('지금은 음성 안내를 쓸 수 없어요.손으로 골라 주세요')
    expect(buttons).toEqual([['btn btn-primary', '손으로 고르기']])
    expect(container.querySelector('.idle-mic')).toBeNull()
    container.querySelector('.btn-primary').click()
    expect(kiosk.dispatch).toHaveBeenCalledWith({ type: EVENTS.MANUAL_SELECT_PRESSED })
  })
})
