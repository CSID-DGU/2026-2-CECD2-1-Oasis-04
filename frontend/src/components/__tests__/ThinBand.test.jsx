// 얇은 띠의 남은 시간 알림 (디자인 문서 11-4절): 무입력 화면(countdown)에서 15초 이하일 때만 시각 자리를 대신한다.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ThinBand from '../ThinBand.jsx'
import { setInactivityDeadline } from '../../effects/inactivityClock.js'
import { withProviders } from '../../screens/__tests__/providers.jsx'

const render = (props) => renderToStaticMarkup(withProviders(<ThinBand {...props} />, { location: { name: '종로3가' } }))

describe('ThinBand 남은 시간 알림', () => {
  afterEach(() => {
    setInactivityDeadline(null)
    vi.useRealTimers()
  })

  it('무입력 타이머가 없으면 시각', () => {
    const html = render({ countdown: true })
    expect(html).toContain('thin-band-now')
    expect(html).not.toContain('timeout-notice')
  })
  it('15초 이하면 알림이 시각을 대신한다', () => {
    vi.useFakeTimers({ now: 100000 })
    setInactivityDeadline(100000 + 15000)
    const html = render({ countdown: true })
    expect(html).toContain('timeout-notice')
    expect(html).toContain('<span class="timeout-notice-left">15</span>초 뒤에 처음으로 돌아가요')
    expect(html).toContain('계속하시려면 화면을 눌러 주세요')
    expect(html).not.toContain('thin-band-now')
  })
  it('16초 이상이면 시각', () => {
    vi.useFakeTimers({ now: 100000 })
    setInactivityDeadline(100000 + 16000)
    expect(render({ countdown: true })).not.toContain('timeout-notice')
  })
  it('countdown 을 켜지 않은 화면에는 알림이 없다', () => {
    vi.useFakeTimers({ now: 100000 })
    setInactivityDeadline(100000 + 5000)
    expect(render({})).not.toContain('timeout-notice')
  })
})
