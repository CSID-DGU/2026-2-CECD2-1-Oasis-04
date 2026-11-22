// 음성 안내 (2026-11-22): 화면이 넘긴 문장을 읽고, 다시 듣기로 다시 읽고, 화면을 떠나면 멈추는지 본다.
import { describe, it, expect, vi } from 'vitest'
import { createVoiceGuide } from '../voiceGuide.js'

function fakeSpeaker({ supported = true } = {}) {
  return {
    calls: [],
    cancelled: 0,
    supported: () => supported,
    speak(lines, options) {
      this.calls.push({ lines, options })
      return true
    },
    cancel() {
      this.cancelled += 1
    },
  }
}

const settings = (over = {}) => () => ({ enabled: true, rate: 'normal', voiceURI: null, ...over })

describe('voiceGuide', () => {
  it('문장을 다듬어서 설정의 빠르기와 목소리로 읽는다', () => {
    const speaker = fakeSpeaker()
    const guide = createVoiceGuide({ speaker, read: settings({ rate: 'slow', voiceURI: 'heami' }) })
    guide.say(['“종로3가역” 맞나요?', '종로3가.탑골공원 정류장에서 내리세요.', '6번 출구로 나가세요.'])
    expect(speaker.calls).toEqual([
      {
        lines: ['종로 삼가역 맞나요?', '종로 삼가, 탑골공원 정류장에서 내리세요.', '육번 출구로 나가세요.'],
        options: { rate: 0.75, voiceURI: 'heami' },
      },
    ])
  })

  it('다시 듣기는 같은 문장을 처음부터 다시 읽는다', () => {
    const speaker = fakeSpeaker()
    const guide = createVoiceGuide({ speaker, read: settings() })
    guide.say(['잘 못 알아들었어요.'])
    expect(guide.replay()).toBe(true)
    expect(speaker.calls.map((c) => c.lines)).toEqual([['잘 못 알아들었어요.'], ['잘 못 알아들었어요.']])
    expect(speaker.calls[1].options).toEqual({ rate: 0.9, voiceURI: null })
  })

  it('화면을 떠나면 멈추고 문장을 잊는다', () => {
    const speaker = fakeSpeaker()
    const guide = createVoiceGuide({ speaker, read: settings() })
    guide.say(['가실 곳을 골라 주세요.'])
    guide.clear()
    expect(speaker.cancelled).toBe(1)
    expect(guide.canReplay()).toBe(false)
    expect(guide.replay()).toBe(false)
    expect(speaker.calls).toHaveLength(1)
  })

  it('빈 문장을 넘기면 읽던 것을 멈춘다', () => {
    const speaker = fakeSpeaker()
    const guide = createVoiceGuide({ speaker, read: settings() })
    guide.say(['문장.'])
    guide.say([])
    expect(speaker.calls).toHaveLength(1)
    expect(speaker.cancelled).toBe(1)
    expect(guide.canReplay()).toBe(false)
  })

  it('설정에서 꺼 두면 읽지 않고 다시 듣기도 없다', () => {
    const speaker = fakeSpeaker()
    const guide = createVoiceGuide({ speaker, read: settings({ enabled: false }) })
    guide.say(['문장.'])
    expect(speaker.calls).toHaveLength(0)
    expect(guide.canReplay()).toBe(false)
  })

  it('브라우저가 읽지 못하면 다시 듣기도 없다', () => {
    const speaker = fakeSpeaker({ supported: false })
    const guide = createVoiceGuide({ speaker, read: settings() })
    guide.say(['문장.'])
    expect(speaker.calls).toHaveLength(0)
    expect(guide.canReplay()).toBe(false)
  })

  it('다시 들을 수 있게 되거나 없어질 때만 알린다', () => {
    const guide = createVoiceGuide({ speaker: fakeSpeaker(), read: settings() })
    const listener = vi.fn()
    const stop = guide.subscribe(listener)
    guide.say(['첫 화면.'])
    expect(guide.canReplay()).toBe(true)
    guide.say(['다른 경로.']) // 여전히 들을 수 있으므로 알리지 않는다
    expect(listener).toHaveBeenCalledTimes(1)
    guide.clear()
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
    guide.say(['다음 화면.'])
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
