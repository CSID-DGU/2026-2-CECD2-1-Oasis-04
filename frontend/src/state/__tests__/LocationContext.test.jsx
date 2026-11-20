// @vitest-environment jsdom
//
// LocationContext (계획서 4-2절): 처음 화면(IDLE, IDLE_REDUCED)에 들어갈 때마다 위치를 조회하고,
// 실패하면 마지막 결과를 그대로 둔다. 다른 화면에서는 조회하지 않는다.
// useKiosk 와 api 를 가짜로 바꿔 끼운다 (ManualSelectScreen.test.jsx 와 같은 방식).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

let kiosk = { state: { state: 'STARTUP_CHECK' }, dispatch: vi.fn() }
vi.mock('../KioskContext.jsx', () => ({ useKiosk: () => kiosk }))
const getLocation = vi.fn()
vi.mock('../../api/index.js', () => ({ api: { getLocation: (...a) => getLocation(...a) } }))

const { LocationProvider, useLocation } = await import('../LocationContext.jsx')

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root
let seen

function Probe() {
  seen = useLocation()
  return null
}

async function renderAt(stateName) {
  kiosk = { state: { state: stateName }, dispatch: vi.fn() }
  await act(async () => {
    root.render(
      <LocationProvider>
        <Probe />
      </LocationProvider>,
    )
  })
}

describe('LocationContext', () => {
  beforeEach(() => {
    getLocation.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    container = document.createElement('div')
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    vi.restoreAllMocks()
  })

  it('처음 화면이 아니면 조회하지 않고, 결과 없이 loading 이다', async () => {
    await renderAt('STARTUP_CHECK')
    expect(getLocation).not.toHaveBeenCalled()
    expect(seen).toEqual({ location: null, status: 'loading' })
  })

  it('IDLE 에 들어가면 조회하고, 다른 화면으로 가도 결과를 들고 있다', async () => {
    getLocation.mockResolvedValue({ name: '종로3가역' })
    await renderAt('IDLE')
    expect(seen).toEqual({ location: { name: '종로3가역' }, status: 'ready' })
    await renderAt('LISTENING')
    expect(getLocation).toHaveBeenCalledTimes(1)
    expect(seen.location.name).toBe('종로3가역')
  })

  it('다시 처음 화면에 오면 또 조회하고, 실패하면 마지막 결과를 그대로 둔다', async () => {
    getLocation.mockResolvedValueOnce({ name: '종로3가역' }).mockRejectedValueOnce(new Error('끊김'))
    await renderAt('IDLE')
    await renderAt('LISTENING')
    await renderAt('IDLE')
    expect(getLocation).toHaveBeenCalledTimes(2)
    expect(seen).toEqual({ location: { name: '종로3가역' }, status: 'ready' })
  })

  it('한 번도 받지 못하고 실패하면 error', async () => {
    getLocation.mockRejectedValue(new Error('끊김'))
    await renderAt('IDLE_REDUCED')
    expect(seen).toEqual({ location: null, status: 'error' })
  })
})
