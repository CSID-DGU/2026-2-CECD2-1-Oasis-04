// @vitest-environment jsdom
//
// ManualSelectScreen '말로 하기' 표시 테스트.
// 시작 점검 결과(state.health)에서 mic 또는 stt 가 false 면 '말로 하기' 버튼을 숨기고,
// 그 외(정상, health 없음)에는 보이며 누르면 SWITCH_TO_VOICE 를 dispatch 하는지 확인한다.
// 전이·reducer 는 건드리지 않으므로 useKiosk 를 가짜로 바꿔 state 만 주입한다.
// 환경: jsdom (화면을 실제로 그려야 해서). 별도 라이브러리 없이 react-dom/client + act 로 렌더한다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { EVENTS } from '../../state/events.js'

// 테스트마다 바꿔 끼우는 가짜 Context 값
let kiosk = { state: { health: null }, dispatch: vi.fn() }
vi.mock('../../state/KioskContext.jsx', () => ({ useKiosk: () => kiosk }))
// 목적지 목록은 이 테스트의 관심사가 아니므로 빈 목록으로 바로 응답
vi.mock('../../api/index.js', () => ({ api: { getPois: vi.fn(async () => []) } }))

const { default: ManualSelectScreen } = await import('../ManualSelectScreen.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root

/** health 를 주고 화면을 그린 뒤 '말로 하기' 버튼(없으면 undefined)을 돌려준다 */
async function renderWith(health) {
  kiosk = { state: { health }, dispatch: vi.fn() }
  await act(async () => {
    root.render(<ManualSelectScreen />)
  })
  return [...container.querySelectorAll('button')].find((b) => b.textContent === '말로 하기')
}

describe("ManualSelectScreen '말로 하기' 버튼", () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('마이크·STT 가 모두 정상이면 보이고, 누르면 SWITCH_TO_VOICE 를 dispatch 한다', async () => {
    const button = await renderWith({ server: true, mic: true, stt: true })
    expect(button).toBeDefined()
    act(() => button.click())
    expect(kiosk.dispatch).toHaveBeenCalledWith({ type: EVENTS.SWITCH_TO_VOICE })
  })

  it('마이크를 쓸 수 없으면 숨긴다', async () => {
    expect(await renderWith({ server: true, mic: false, stt: true })).toBeUndefined()
  })

  it('STT 를 쓸 수 없으면 숨긴다', async () => {
    expect(await renderWith({ server: true, mic: true, stt: false })).toBeUndefined()
  })

  it("숨겨도 '처음으로' 버튼은 남아 있다", async () => {
    await renderWith({ server: true, mic: false, stt: false })
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent)
    expect(labels).toContain('처음으로')
    expect(labels).not.toContain('말로 하기')
  })

  it('점검 결과가 아직 없으면(null) 보인다', async () => {
    expect(await renderWith(null)).toBeDefined()
  })
})
