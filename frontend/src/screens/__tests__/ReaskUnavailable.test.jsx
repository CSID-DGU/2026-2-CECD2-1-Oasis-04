// REASKING·UNAVAILABLE 이 상태 값으로 글과 그림을 고르는지 본다 (디자인 문서 12-2·12-3절). 모양은 스크린샷으로 확인한다.
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

let kiosk = { state: {}, dispatch: vi.fn() }
vi.mock('../../state/KioskContext.jsx', () => ({ useKiosk: () => kiosk }))
vi.mock('../../components/ThinBand.jsx', () => ({ default: () => null }))

const { default: ReaskingScreen } = await import('../ReaskingScreen.jsx')
const { default: UnavailableScreen } = await import('../UnavailableScreen.jsx')

const render = (Screen, state) => {
  kiosk = { state, dispatch: vi.fn() }
  return renderToStaticMarkup(<Screen />)
}

describe('REASKING', () => {
  it('들은 말이 있으면 한 줄, 예시는 한 줄', () => {
    const html = render(ReaskingScreen, { transcript: '병원' })
    expect(html).toContain('<b>병원</b>')
    expect(html.match(/<li>/g)).toHaveLength(1)
    expect(html).not.toContain('is-error')
  })
  it('들은 말이 비면 그 줄을 숨긴다', () => {
    expect(render(ReaskingScreen, { transcript: '' })).not.toContain('heard-line')
  })
})

describe('UNAVAILABLE', () => {
  it('첫 문장만 오류 색, 나머지는 본문 줄', () => {
    const html = render(UnavailableScreen, { error: { code: 'TOO_CLOSE', message: '가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.' } })
    expect(html).toMatch(/is-error[^>]*>가까운 곳이라 걸어서 가실 수 있어요\.</)
    expect(html).toContain('ring-stack-more wrap-even is-keep-all">약 300미터예요.<')
  })
  it('나머지 문장이 없으면 그 줄을 그리지 않는다', () => {
    expect(render(UnavailableScreen, { error: { code: 'NO_ROUTE', message: null } })).not.toContain('ring-stack-more')
  })
})
