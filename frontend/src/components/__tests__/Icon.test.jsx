// 아이콘 부품 테스트: 시안이 쓰는 이름이 모두 있고, 그리면 SVG 가 나오며, 없는 이름은 아무것도 그리지 않는다.
// 화면에 보이는 모양은 스크린샷으로 확인한다 (계획서 6-A절). 여기서는 파일을 빠짐없이 읽었는지만 본다.

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Icon from '../Icon.jsx'
import RingIcon from '../RingIcon.jsx'
import { ICON_NAMES, RING_ICON_NAMES } from '../iconSource.js'

// 확정 시안(design/mockups/confirmed/)에서 쓰는 아이콘
const USED_IN_MOCKUPS = ['check', 'chevron_right', 'close', 'home', 'mic', 'schedule', 'smartphone', 'touch_app', 'logo']
const RING_USED = ['flag', 'bubble', 'logo', 'walk', 'pin', 'clock', 'mic'] // mic: LISTENING 고리 (2단계)

describe('Icon', () => {
  it('시안이 쓰는 아이콘 파일이 모두 있다', () => {
    for (const name of USED_IN_MOCKUPS) expect(ICON_NAMES).toContain(name)
  })

  it('그리면 viewBox 와 모양이 있는 SVG 가 나오고, 화면 읽기에서는 숨긴다', () => {
    for (const name of ICON_NAMES) {
      const html = renderToStaticMarkup(<Icon name={name} />)
      expect(html, name).toMatch(/^<svg[^>]*viewBox="[^"]+"/)
      expect(html, name).toMatch(/<(path|circle)\b/)
      expect(html, name).toContain('aria-hidden="true"')
    }
  })

  it('없는 이름이면 아무것도 그리지 않고 경고만 남긴다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(renderToStaticMarkup(<Icon name="no-such-icon" />)).toBe('')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})

describe('RingIcon', () => {
  it('고리 안 그림 일곱 가지가 모두 있다 (시계·마이크는 Material)', () => {
    expect([...RING_ICON_NAMES].sort()).toEqual([...RING_USED].sort())
    for (const name of RING_USED) {
      expect(renderToStaticMarkup(<RingIcon name={name} />), name).toMatch(/^<svg[^>]*class="ring-icon/)
    }
  })

  it('손 그림은 선(is-line), 시계는 채운 모양이다', () => {
    expect(renderToStaticMarkup(<RingIcon name="flag" />)).toContain('is-line')
    expect(renderToStaticMarkup(<RingIcon name="clock" />)).toContain('is-fill-icon')
  })
})
