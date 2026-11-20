// @vitest-environment jsdom
//
// QR_HANDOFF 화면 (계획서 10단계): 보내는 경로의 id 로 createQr 를 부르고 받은 주소로 QR 그림을 그린다.
// 실패하거나 경로가 없으면 QR 자리에 글만 보이고 이벤트는 보내지 않는다. 버튼은 '처음으로' 하나, 주 버튼 없음.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ROUTE_SUBWAY } from '../../api/mock/data/routeCases.js'
import { withProviders } from './providers.jsx'

let kiosk = { state: { routes: [] }, dispatch: vi.fn() }
vi.mock('../../state/KioskContext.jsx', () => ({ useKiosk: () => kiosk }))
const createQr = vi.fn()
vi.mock('../../api/index.js', () => ({ api: { createQr: (...a) => createQr(...a) } }))

const { default: QrHandoffScreen } = await import('../QrHandoffScreen.jsx')
const { QR_MESSAGES } = await import('../qrHandoffText.js')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root

async function renderWith(routes, selectedRouteId = null) {
  kiosk = { state: { routes, selectedRouteId }, dispatch: vi.fn() }
  await act(async () => {
    root.render(withProviders(<QrHandoffScreen />))
  })
}
const box = () => container.querySelector('.qr-box')

describe('QrHandoffScreen', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    createQr.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  it('1순위 경로 id 로 QR 을 만들고 단계 세 줄·요약 판·처음으로를 보인다', async () => {
    createQr.mockResolvedValue({ url: 'https://example.com/r/A' })
    await renderWith(ROUTE_SUBWAY)
    expect(createQr).toHaveBeenCalledWith(ROUTE_SUBWAY[0].id)
    expect(box().dataset.status).toBe('ready')
    expect(box().querySelector('svg path').getAttribute('d')).toMatch(/^M\d/)
    expect([...container.querySelectorAll('.qr-handoff-steps li')].map((li) => li.textContent)).toEqual([
      '1휴대폰 카메라를 켜요',
      '2QR에 비춰요',
      '3길 안내가 열려요',
    ])
    expect(container.querySelectorAll('.route-card.is-only')).toHaveLength(1)
    expect([...container.querySelectorAll('button')].map((b) => b.textContent.trim())).toEqual(['처음으로'])
    expect(container.querySelector('.btn-primary')).toBeNull()
    expect(container.textContent).not.toContain('주소 글자')
    expect(kiosk.dispatch).not.toHaveBeenCalled()
  })

  it('고른 경로(selectedRouteId = 2번)로 QR 과 요약 판을 만든다 (11단계)', async () => {
    createQr.mockResolvedValue({ url: 'https://example.com/r/B' })
    await renderWith(ROUTE_SUBWAY, ROUTE_SUBWAY[1].id)
    expect(createQr).toHaveBeenCalledWith(ROUTE_SUBWAY[1].id)
    expect(createQr).toHaveBeenCalledTimes(1)
    expect(container.querySelector('.route-card.is-only').textContent).toContain(`${ROUTE_SUBWAY[1].durationMin}`)
  })

  it('고른 경로 id 가 목록에 없으면 첫 경로를 쓴다', async () => {
    createQr.mockResolvedValue({ url: 'https://example.com/r/A' })
    await renderWith(ROUTE_SUBWAY, 'no-such-route')
    expect(createQr).toHaveBeenCalledWith(ROUTE_SUBWAY[0].id)
  })

  it('QR 무늬 둘레 흰 여백은 늘 칸 4개 (viewBox 가 무늬 밖으로 4칸)', async () => {
    createQr.mockResolvedValue({ url: 'https://example.com/r/A' })
    await renderWith(ROUTE_SUBWAY)
    const [x, y, w] = box().querySelector('svg').getAttribute('viewBox').split(' ').map(Number)
    expect(x).toBe(-4)
    expect(y).toBe(x)
    expect(w + x * 2).toBeGreaterThanOrEqual(21) // 무늬 칸 수
  })

  it('만들지 못하면(real 에 landing_url 없음 등) QR 자리에 오류 글, 이벤트 없음', async () => {
    createQr.mockRejectedValue(new Error('QR_ERROR'))
    await renderWith(ROUTE_SUBWAY)
    expect(box().dataset.status).toBe('error')
    expect(box().textContent).toBe(QR_MESSAGES.createError)
    expect(kiosk.dispatch).not.toHaveBeenCalled()
  })

  it('경로가 없으면 부르지 않고 "보낼 경로가 없어요", 요약 판 없음', async () => {
    await renderWith([])
    expect(createQr).not.toHaveBeenCalled()
    expect(box().textContent).toBe(QR_MESSAGES.noRoute)
    expect(container.querySelector('.route-card')).toBeNull()
  })

  it('만드는 중에는 "만드는 중이에요"', async () => {
    createQr.mockReturnValue(new Promise(() => {}))
    await renderWith(ROUTE_SUBWAY)
    expect(box().dataset.status).toBe('loading')
    expect(box().textContent).toBe(QR_MESSAGES.loading)
  })
})
