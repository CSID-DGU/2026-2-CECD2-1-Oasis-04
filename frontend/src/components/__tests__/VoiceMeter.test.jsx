// @vitest-environment jsdom
// VoiceMeter: 음량을 읽어 막대 속성만 바꾸고, 잴 수 없으면 멈춘 모양, 언마운트하면 프레임 반복을 멈춘다 (12단계)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import VoiceMeter from '../VoiceMeter.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let frames
let reduce
beforeEach(() => {
  frames = new Map()
  let id = 0
  reduce = false
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    id += 1
    frames.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (i) => frames.delete(i))
  vi.stubGlobal('matchMedia', () => ({ matches: reduce }))
})
const roots = []
afterEach(() => {
  roots.splice(0).forEach((r) => act(() => r.unmount()))
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

function render(element) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => root.render(element))
  roots.push(root)
  return {
    container,
    unmount: () => {
      roots.splice(roots.indexOf(root), 1)
      act(() => root.unmount())
    },
  }
}

// 쌓인 프레임을 한 번 돌린다
const tick = (now) => {
  const cbs = [...frames.values()]
  frames.clear()
  cbs.forEach((cb) => cb(now))
}
// jsdom 은 CSS 변수를 계산하지 않아 좌표는 비교할 수 없다. 막대 길이에 따라 바뀌는 진하기로 본다
const ends = (c) => [...c.querySelectorAll('line')].map((l) => l.getAttribute('stroke-opacity')).join(' ')

describe('VoiceMeter', () => {
  it('막대 40개를 그린다', () => {
    const { container } = render(<VoiceMeter />)
    expect(container.querySelectorAll('line')).toHaveLength(40)
  })

  it('음량을 못 재면(null·오류) 멈춘 모양 그대로', () => {
    const { container: a } = render(<VoiceMeter readLevel={() => null} />)
    const still = ends(a)
    tick(100)
    tick(200)
    expect(ends(a)).toBe(still)
    const { container: b } = render(<VoiceMeter readLevel={() => { throw new Error('x') }} />)
    tick(300)
    expect(ends(b)).toBe(still)
  })

  it('큰 소리면 막대가 바뀌고, 언마운트하면 프레임 반복이 멈춘다', () => {
    const read = vi.fn(() => 0.3)
    const { container, unmount } = render(<VoiceMeter readLevel={read} />)
    const still = ends(container)
    tick(16)
    tick(500)
    expect(ends(container)).not.toBe(still)
    expect(read).toHaveBeenCalled()
    unmount()
    expect(frames.size).toBe(0)
  })

  it('움직임 줄이기면 프레임을 돌리지 않고 음량도 읽지 않는다', () => {
    reduce = true
    const read = vi.fn(() => 0.3)
    render(<VoiceMeter readLevel={read} />)
    expect(frames.size).toBe(0)
    expect(read).not.toHaveBeenCalled()
  })
})
