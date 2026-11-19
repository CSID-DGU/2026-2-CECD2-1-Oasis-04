// @vitest-environment jsdom
//
// ROUTE_GUIDE 화면 (계획서 9단계): 카드 고르기는 화면 안 상태라 이벤트를 보내지 않는다.
// 경로 1개면 카드 대신 요약 판(버튼 아님), 휴대폰으로 보내기는 SEND_TO_PHONE_PRESSED.
// 줄이기 단계·선 그리기처럼 글자 너비가 필요한 것은 jsdom 이 재지 못하므로 스크린샷으로 본다 (scripts/screens/shoot-route.js)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { EVENTS } from '../../state/events.js'
import { ROUTE_SUBWAY, ROUTE_A } from '../../api/mock/data/routeCases.js'
import { withProviders } from './providers.jsx'

let kiosk = { state: { routes: [] }, dispatch: vi.fn() }
vi.mock('../../state/KioskContext.jsx', () => ({ useKiosk: () => kiosk }))

const { default: RouteGuideScreen } = await import('../RouteGuideScreen.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root

async function renderWith(routes, location = { name: '종로3가역', place: null }) {
  kiosk = { state: { routes }, dispatch: vi.fn() }
  await act(async () => {
    root.render(withProviders(<RouteGuideScreen />, { location }))
  })
}
const cards = () => [...container.querySelectorAll('button.route-card')]
const firstStopName = () => container.querySelector('.timeline-name')?.textContent

describe('RouteGuideScreen', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('경로 3개: 카드 3개, 처음에는 1순위를 고른다', async () => {
    await renderWith(ROUTE_SUBWAY)
    expect(cards().map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    expect(container.textContent).toContain('2번째 역에서 내려요') // A: 3호선 2번째 역
  })

  it('2번 카드를 누르면 그 경로를 자세히 보이고, 이벤트는 보내지 않는다', async () => {
    await renderWith(ROUTE_SUBWAY)
    await act(async () => cards()[1].click())
    expect(cards().map((c) => c.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    expect(container.textContent).toContain('서울역') // B: 1호선 → 서울역에서 갈아탄다
    expect(container.querySelector('.timeline').classList.contains('is-appearing')).toBe(true)
    expect(kiosk.dispatch).not.toHaveBeenCalled()
  })

  it('경로 1개: 카드 대신 요약 판, 휴대폰으로 보내기는 SEND_TO_PHONE_PRESSED', async () => {
    await renderWith([ROUTE_A])
    expect(cards()).toHaveLength(0)
    expect(container.querySelector('.route-card.is-only')).not.toBeNull()
    const send = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === '휴대폰으로 보내기')
    await act(async () => send.click())
    expect(kiosk.dispatch).toHaveBeenCalledWith({ type: EVENTS.SEND_TO_PHONE_PRESSED })
  })

  it('경로에 출발 장소가 없으면 지금 계신 곳 이름을 띠와 같은 규칙으로 쓴다', async () => {
    const legs = [{ mode: 'WALK', minutes: 2, to: { name: '종로3가역', kind: 'STATION' } }, ...ROUTE_A.legs]
    await renderWith([{ id: 'r', durationMin: 10, legs }], { name: '종로3가역 키오스크', place: null })
    expect(firstStopName()).toBe('종로3가')
  })

  it('경로가 없으면 안내 문구만', async () => {
    await renderWith([])
    expect(container.textContent).toContain('보여 드릴 경로가 없어요')
  })
})
