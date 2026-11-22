// @vitest-environment jsdom
//
// 설정 페이지의 '경로' 탭 테스트 (2026-11-22): 두 제공자의 상태와 남은 횟수가 보이는지, 고르고 저장하면 브라우저에 적히는지,
// 연결 확인 결과에 남은 횟수가 붙는지.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import RouteTab from '../RouteTab.jsx'
import SettingsPage from '../SettingsPage.jsx'
import { ROUTE_BACKUP_KEY } from '../routeBackup.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data }
}

const usage = (configured, usedToday, dailyLimit) => ({ configured, usedToday, dailyLimit })
const READY = { reachable: true, kakao: usage(true, 12, 1000), odsay: usage(true, 1, 30) }
const NO_ODSAY_KEY = { reachable: true, kakao: usage(true, 0, 1000), odsay: usage(false, 0, 30) }

let container
let root

async function open({ storage = fakeStorage(), statuses = [READY], onDone = vi.fn(), test = vi.fn(async () => '연결됨: 종로3가역 → 서울역 경로 15개를 받았습니다') } = {}) {
  let n = 0
  const probeRoute = vi.fn(async () => statuses[Math.min(n++, statuses.length - 1)])
  await act(async () => {
    root.render(<RouteTab storage={storage} onDone={onDone} probeRoute={probeRoute} test={test} />)
  })
  return { storage, onDone, probeRoute, test }
}
const radio = (value) => container.querySelector(`input[name="route-backup"][value="${value}"]`)
const button = (text) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text))
const statusRows = () => [...container.querySelectorAll('.settings-status dt')].map((dt) => [dt.textContent, dt.nextElementSibling.textContent])

describe('설정 페이지: 경로 탭', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('찾는 방법은 카카오 먼저 → ODsay 로만 → 백업 쓰지 않기 순서이고, 처음에는 카카오 먼저가 골라져 있다', async () => {
    await open()
    expect([...container.querySelectorAll('input[name="route-backup"]')].map((r) => r.value)).toEqual(['auto', 'only', 'off'])
    expect([...container.querySelectorAll('.settings-choice strong')].map((s) => s.textContent)).toEqual([
      '카카오 먼저, 실패하면 ODsay',
      'ODsay 로만 찾기',
      '백업 쓰지 않기',
    ])
    expect(radio('auto').checked).toBe(true)
  })

  it('카카오맵과 ODsay 의 쓴 횟수와 남은 횟수를 보인다', async () => {
    await open()
    expect(statusRows()).toEqual([
      ['카카오맵', '키 있음 · 오늘 12회 사용 · 남은 횟수 988회 (하루 1,000회)'],
      ['ODsay', '키 있음 · 오늘 1회 사용 · 남은 횟수 29회 (하루 30회)'],
    ])
  })

  it('서버에 ODsay 키가 없으면 그 줄만 붉게 알린다', async () => {
    await open({ statuses: [NO_ODSAY_KEY] })
    const off = [...container.querySelectorAll('dd.is-off')]
    expect(off).toHaveLength(1)
    expect(off[0].textContent).toContain('ODSAY_API_KEY')
  })

  it('저장해 둔 값이 골라져 있고, 바꿔서 저장하면 브라우저에 적는다', async () => {
    const { storage, onDone } = await open({ storage: fakeStorage({ [ROUTE_BACKUP_KEY]: 'only' }) })
    expect(radio('only').checked).toBe(true)
    act(() => radio('off').click())
    expect(storage.data.get(ROUTE_BACKUP_KEY)).toBe('only') // 저장을 누르기 전에는 그대로
    act(() => button('저장하고').click())
    expect(storage.data.get(ROUTE_BACKUP_KEY)).toBe('off')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('카카오맵 연결 확인: 카카오로만 찾아 보고, 결과에 남은 횟수를 붙인다', async () => {
    const after = { reachable: true, kakao: usage(true, 13, 1000), odsay: usage(true, 1, 30) }
    const { test, probeRoute } = await open({ statuses: [READY, after] })
    await act(async () => {
      button('카카오맵 연결 확인').click()
    })
    expect(test).toHaveBeenCalledWith('kakao')
    expect(container.querySelector('[role="status"]').textContent).toBe('연결됨: 종로3가역 → 서울역 경로 15개를 받았습니다 · 남은 횟수 987회')
    expect(probeRoute).toHaveBeenCalledTimes(2)
    expect(statusRows()[0][1]).toContain('오늘 13회 사용 · 남은 횟수 987회')
  })

  it('ODsay 연결 확인: ODsay 로만 찾아 보고, 결과에 남은 횟수를 붙인다', async () => {
    const after = { reachable: true, kakao: usage(true, 12, 1000), odsay: usage(true, 2, 30) }
    const test = vi.fn(async () => '연결됨: 종로3가역 → 서울역 경로 3개를 받았습니다')
    await open({ statuses: [READY, after], test })
    await act(async () => {
      button('ODsay 연결 확인').click()
    })
    expect(test).toHaveBeenCalledWith('odsay')
    expect(container.querySelector('[role="status"]').textContent).toBe('연결됨: 종로3가역 → 서울역 경로 3개를 받았습니다 · 남은 횟수 28회')
  })

  it('남은 횟수를 모르면 결과 문장만 보인다', async () => {
    const test = vi.fn(async () => '실패: 경로 서버에 닿지 못했습니다')
    await open({ statuses: [{ reachable: false, kakao: null, odsay: null }], test })
    await act(async () => {
      button('카카오맵 연결 확인').click()
    })
    expect(container.querySelector('[role="status"]').textContent).toBe('실패: 경로 서버에 닿지 못했습니다')
  })

  it('저장하지 못하면 알리고 화면에 남는다', async () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {},
    }
    const { onDone } = await open({ storage: broken })
    act(() => radio('off').click())
    act(() => button('저장하고').click())
    expect(container.querySelector('[role="alert"]').textContent).toContain('저장하지 못했습니다')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('설정 페이지에 경로 탭이 있다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('no server'))))
    await act(async () => {
      root.render(<SettingsPage storage={fakeStorage()} probe={async () => ({ reachable: false })} onDone={() => {}} />)
    })
    const tab = [...container.querySelectorAll('[role="tab"]')].find((t) => t.textContent === '경로')
    await act(async () => {
      tab.click()
    })
    expect(container.querySelector('h2').textContent).toBe('경로 찾기 (카카오 · ODsay 백업)')
    vi.unstubAllGlobals()
  })
})
