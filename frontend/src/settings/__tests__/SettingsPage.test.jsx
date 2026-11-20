// @vitest-environment jsdom
//
// 설정 페이지의 '서버 연동' 탭 테스트: 저장된 선택과 서버 상태가 보이는지, 고르고 저장하면 브라우저에 적히는지.
// 환경: jsdom (눌러 봐야 해서). 별도 라이브러리 없이 react-dom/client + act 로 그린다.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import SettingsPage from '../SettingsPage.jsx'
import { STORAGE_KEY } from '../integration.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data }
}

const TRAINED = { reachable: true, ready: true, engine: 'finetuned', model: 'whisper-large-v3-turbo + senior-voice-lora' }
const MISSING = { reachable: false, ready: false, engine: null, model: null }

let container
let root

async function open({ storage = fakeStorage(), status = TRAINED, onDone = vi.fn() } = {}) {
  await act(async () => {
    root.render(<SettingsPage storage={storage} probe={async () => status} onDone={onDone} />)
  })
  return { storage, onDone }
}
const radio = (value) => container.querySelector(`input[type="radio"][value="${value}"]`)
const button = (text) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(text))
const text = () => container.textContent

describe('설정 페이지: 서버 연동 탭', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it('처음에는 자동이 골라져 있고, 서버가 응답하면 켜진다고 알린다', async () => {
    await open()
    expect(container.querySelector('[role="tab"][aria-selected="true"]').textContent).toBe('서버 연동')
    expect(radio('auto').checked).toBe(true)
    expect(text()).toContain('연결됨 · whisper-large-v3-turbo + senior-voice-lora (학습한 모델)')
    expect(text()).toContain('연동이 켜집니다 (자동: 서버가 응답해서 켰습니다)')
  })

  it('서버가 없으면 자동은 꺼진다고 알린다', async () => {
    await open({ status: MISSING })
    expect(text()).toContain('서버가 응답하지 않습니다')
    expect(text()).toContain('연동이 꺼집니다 (자동: 서버가 응답하지 않아 껐습니다)')
  })

  it('저장해 둔 선택이 골라져 있다', async () => {
    await open({ storage: fakeStorage({ [STORAGE_KEY]: 'off' }) })
    expect(radio('off').checked).toBe(true)
    expect(text()).toContain('연동이 꺼집니다 (끄기로 설정했습니다)')
  })

  it('끄기를 고르고 저장하면 브라우저에 적고 키오스크 화면으로 돌아간다', async () => {
    const { storage, onDone } = await open()
    act(() => radio('off').click())
    expect(text()).toContain('연동이 꺼집니다 (끄기로 설정했습니다)')
    expect(storage.data.has(STORAGE_KEY)).toBe(false) // 저장을 누르기 전에는 적지 않는다
    act(() => button('저장하고').click())
    expect(storage.data.get(STORAGE_KEY)).toBe('off')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('켜기를 고르면 서버가 없어도 켜진다고 알리고, 자동으로 되돌리면 저장된 값을 지운다', async () => {
    const { storage } = await open({ storage: fakeStorage({ [STORAGE_KEY]: 'off' }), status: MISSING })
    act(() => radio('on').click())
    expect(text()).toContain('연동이 켜집니다 (켜기로 설정했습니다)')
    act(() => radio('auto').click())
    act(() => button('저장하고').click())
    expect(storage.data.has(STORAGE_KEY)).toBe(false)
  })

  it('저장하지 않고 돌아가면 아무것도 적지 않는다', async () => {
    const { storage, onDone } = await open()
    act(() => radio('off').click())
    act(() => button('저장하지 않고').click())
    expect(storage.data.size).toBe(0)
    expect(onDone).toHaveBeenCalledTimes(1)
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
    act(() => radio('on').click())
    act(() => button('저장하고').click())
    expect(container.querySelector('[role="alert"]').textContent).toContain('저장하지 못했습니다')
    expect(onDone).not.toHaveBeenCalled()
  })
})
