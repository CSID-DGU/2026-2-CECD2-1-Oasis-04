// CONFIRMING·MANUAL_SELECT 가 상태 값으로 고르는 카드·'예'·상태 문구를 고르는지 본다 (디자인 문서 11절, 12-4절).
// 모양은 스크린샷으로 확인한다. mock 데이터(명동 후보, 목적지 12개)도 여기서 센다.
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { withProviders } from './providers.jsx'
import { MANUAL_POIS, MYEONGDONG } from '../../api/mock/data/pois.js'

let kiosk = { state: {}, dispatch: vi.fn() }
vi.mock('../../state/KioskContext.jsx', () => ({ useKiosk: () => kiosk }))

const { default: ConfirmingScreen } = await import('../ConfirmingScreen.jsx')
const { default: ManualSelectScreen } = await import('../ManualSelectScreen.jsx')
const { resolve } = await import('../../api/mock/resolve.js')
const { getPois } = await import('../../api/mock/pois.js')
vi.mock('../../api/mock/mockDelay.js', () => ({ mockDelay: async () => {} }))

const render = (Screen, state) => {
  kiosk = { state, dispatch: vi.fn() }
  return renderToStaticMarkup(withProviders(<Screen />, { location: { name: '종로3가' } }))
}
const count = (html, re) => (html.match(re) ?? []).length

describe('CONFIRMING', () => {
  it('후보 여러 개면 고르는 카드 1열, 본문에 주 버튼 없음', () => {
    const html = render(ConfirmingScreen, { transcript: '명동', resolve: { candidates: [...MYEONGDONG] } })
    expect(html).toContain('pick-list is-confirm')
    expect(count(html, /class="pick"/g)).toBe(3)
    expect(html).toContain('<small class="pick-kind">지하철 4호선</small>')
    expect(html).not.toContain('btn-primary')
    expect(html).toContain('<b>명동</b>')
  })
  it("후보 1개면 물음과 '예' 주 버튼 하나, 분류는 괄호 없이", () => {
    const html = render(ConfirmingScreen, { transcript: '병원', resolve: { candidates: [{ id: 'a', name: '동국대병원', category: '병원' }] } })
    expect(html).toContain('“동국대병원” 맞나요?')
    expect(html).toContain('<p class="confirm-ask-kind">병원</p>')
    expect(count(html, /btn-primary/g)).toBe(1)
    expect(html).not.toContain('class="pick"')
  })
  it('들은 말이 비면 그 줄을 숨긴다', () => {
    expect(render(ConfirmingScreen, { transcript: '', resolve: { candidates: [...MYEONGDONG] } })).not.toContain('heard-line')
  })
})

describe('MANUAL_SELECT', () => {
  it('처음에는 불러오는 중 (작은 고리 + 문구)', () => {
    const html = render(ManualSelectScreen, { health: null })
    expect(html).toContain('small-ring')
    expect(html).toContain('불러오는 중이에요')
    expect(html).not.toContain('pick-list')
  })
})

describe('mock 데이터', () => {
  it('"명동" 은 명동역·명동성당·명동입구 후보', async () => {
    const r = await resolve('명동')
    expect(r.needConfirm).toBe(true)
    expect(r.candidates.map((p) => p.name)).toEqual(['명동역', '명동성당', '명동입구'])
  })
  it('예전 키워드는 그대로: "병원" 은 후보 3개, "서울역" 은 바로', async () => {
    expect((await resolve('병원')).candidates).toHaveLength(3)
    expect((await resolve('서울역')).poi.id).toBe('poi-seoul-station')
    expect((await resolve('외딴섬 선착장')).poi.id).toBe('poi-no-route')
  })
  it('목적지 목록은 확정 시안의 12개', async () => {
    const pois = await getPois()
    expect(pois).toHaveLength(12)
    expect(pois).toEqual([...MANUAL_POIS])
    expect(new Set(pois.map((p) => p.id)).size).toBe(12)
  })
})
