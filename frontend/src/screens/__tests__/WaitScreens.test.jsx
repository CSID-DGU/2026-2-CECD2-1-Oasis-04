// 기다림 화면이 실제 상태 값을 쓰는지, 빈 값 규칙(디자인 문서 10-3절)을 지키는지 본다.
// 띠(ThinBand)와 글씨 줄이기 훅은 이 테스트의 관심사가 아니라 가짜로 바꾼다. 모양은 스크린샷으로 확인한다.
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

let kiosk = { state: {}, dispatch: vi.fn() }
vi.mock('../../state/KioskContext.jsx', () => ({ useKiosk: () => kiosk }))
vi.mock('../../components/ThinBand.jsx', () => ({ default: () => null }))

const { default: ResolvingScreen } = await import('../ResolvingScreen.jsx')
const { default: RoutingScreen } = await import('../RoutingScreen.jsx')

const render = (Screen, state) => {
  kiosk = { state, dispatch: vi.fn() }
  return renderToStaticMarkup(<Screen />)
}

describe('RESOLVING', () => {
  it('들은 말을 따옴표와 함께 큰 글씨로, 머리말·안내 줄', () => {
    const html = render(ResolvingScreen, { transcript: '병원' })
    expect(html).toContain('“병원”')
    expect(html).toContain('wait-label')
    expect(html).toContain('말씀을 알아듣는 중이에요')
  })
  it('들은 말이 비면 머리말·안내 줄 없이 "말씀을 알아듣는 중이에요" 만', () => {
    for (const transcript of ['', '   ']) {
      const html = render(ResolvingScreen, { transcript })
      expect(html).not.toContain('wait-label')
      expect(html).not.toContain('wait-sub')
      expect(html).toContain('말씀을 알아듣는 중이에요')
    }
  })
})

describe('ROUTING', () => {
  it('고른 목적지 이름이 큰 글씨', () => {
    const html = render(RoutingScreen, { selectedPoi: { id: 'p1', name: '명동역' } })
    expect(html).toContain('>명동역<')
    expect(html).toContain('가실 곳')
  })
})
