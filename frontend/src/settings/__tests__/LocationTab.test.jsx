// @vitest-environment jsdom
//
// 설정 페이지의 '위치' 탭 테스트: 방법을 고르고, 역·정류장을 찾아 고르고, 저장하면 브라우저에 적히는지.
// 환경: jsdom. 찾기(find)와 브라우저 위치(locate)는 가짜를 넣는다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import LocationTab from '../LocationTab.jsx'
import { PLACE_KEY } from '../kioskPlace.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data }
}

const JONGNO = { poiId: 'SUB_0130_1호선', name: '종로3가역', type: 'SUBWAY_STATION', number: '130', line: '1호선' }
const TAPGOL = { poiId: 'BUS_100000002', name: '종로3가.탑골공원 정류장', type: 'BUS_STOP', number: '01-010', line: '' }

let container
let root

async function open({ storage = fakeStorage(), find = vi.fn(async () => [JONGNO, TAPGOL]), locate = vi.fn(), onDone = vi.fn() } = {}) {
  await act(async () => {
    root.render(<LocationTab storage={storage} find={find} locate={locate} onDone={onDone} />)
  })
  return { storage, find, locate, onDone }
}
const radio = (value) => container.querySelector(`input[name="kiosk-place"][value="${value}"]`)
const button = (text) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text))
const text = () => container.textContent
/** 찾는 말을 넣고 '찾기' 를 누른다 */
async function searchFor(query) {
  const input = container.querySelector('input[type="search"]')
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, query)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

describe('설정 페이지: 위치 탭', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('처음에는 현재 위치로 찾기가 골라져 있고, 찾는 칸은 보이지 않는다', async () => {
    await open()
    expect(radio('auto').checked).toBe(true)
    expect(container.querySelector('input[type="search"]')).toBeNull()
    expect(button('저장하고').disabled).toBe(false)
  })

  it('지금 위치 확인을 누르면 브라우저가 준 위치의 오차를 알려 준다', async () => {
    const locate = vi.fn(async () => ({ position: { x: 127, y: 37.5, accuracy: 4800 }, reason: null }))
    await open({ locate })
    await act(async () => button('지금 위치 확인').click())
    expect(locate).toHaveBeenCalledTimes(1)
    expect(text()).toContain('오차가 약 4,800 m 입니다')
    expect(text()).toContain('직접 지정해 주세요')
  })

  it('직접 지정: 번호나 이름으로 찾아 고르고 저장하면 브라우저에 적힌다', async () => {
    const { storage, find, onDone } = await open()
    act(() => radio('manual').click())
    expect(button('저장하고').disabled).toBe(true) // 아직 고른 곳이 없다
    await searchFor('130')
    expect(find).toHaveBeenCalledWith('130')
    expect(text()).toContain('종로3가역 · 1호선 · 역 번호 130')
    expect(text()).toContain('종로3가.탑골공원 정류장 · 정류장 번호 01-010')

    const picks = container.querySelectorAll('input[name="kiosk-place-pick"]')
    act(() => picks[1].click())
    expect(text()).toContain('고른 곳: 종로3가.탑골공원 정류장 · 정류장 번호 01-010')
    act(() => button('저장하고').click())
    expect(JSON.parse(storage.data.get(PLACE_KEY))).toEqual({ mode: 'manual', place: TAPGOL })
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('저장해 둔 곳이 있으면 직접 지정과 그곳이 골라져 있고, 현재 위치로 되돌려 저장하면 지운다', async () => {
    const { storage } = await open({ storage: fakeStorage({ [PLACE_KEY]: JSON.stringify({ mode: 'manual', place: JONGNO }) }) })
    expect(radio('manual').checked).toBe(true)
    expect(text()).toContain('고른 곳: 종로3가역 · 1호선 · 역 번호 130')
    act(() => radio('auto').click())
    act(() => button('저장하고').click())
    expect(storage.data.has(PLACE_KEY)).toBe(false)
  })

  it('찾은 것이 없거나 서버에 닿지 못하면 알린다', async () => {
    await open({ find: vi.fn(async () => []) })
    act(() => radio('manual').click())
    await searchFor('없는역')
    expect(text()).toContain('해당하는 역·정류장이 없습니다')

    act(() => root.unmount())
    root = createRoot(container)
    await open({
      find: vi.fn(async () => {
        throw new Error('SERVER_UNREACHABLE')
      }),
    })
    act(() => radio('manual').click())
    await searchFor('130')
    expect(container.querySelector('[role="alert"]').textContent).toContain('음성 인식 서버가 켜져 있는지')
  })
})
