// mockRecorder 테스트 (계획서 Phase 6-2, 타이머).
// 무발화 타이머(config.noSpeechMs)와 무음 타이머(config.silenceMs)가 설정값대로 onSpeechEnd 를 부르는지,
// stop() 뒤에는 어떤 경로로도 콜백이 오지 않는지, start() 를 연속으로 불러도 타이머가 겹치지 않는지 확인한다.
// 시간은 vi.useFakeTimers 로 직접 흘린다.
//
// config 는 import.meta.env 를 읽는 모듈이라 테스트에서는 vi.mock 으로 고정값으로 바꿔 끼운다
// (.env 에 따라 값이 달라지면 테스트가 흔들리므로).
// 환경: node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const NO_SPEECH_MS = 4000
const SILENCE_MS = 2500

vi.mock('../../config.js', () => ({
  config: { noSpeechMs: NO_SPEECH_MS, silenceMs: SILENCE_MS },
}))

// vi.mock 은 파일 맨 위로 끌어올려지므로(hoisting) 그 뒤에 import 해야 가짜 config 가 들어간다
const recorder = await import('../mockRecorder.js')

describe('mockRecorder (무발화·무음 타이머)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {}) // mock 의 호출 로그는 테스트 출력에서 숨긴다
  })
  afterEach(() => {
    recorder.stop() // 모듈 변수(세션)를 다음 테스트를 위해 비운다
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('start 뒤 noSpeechMs 직전까지는 콜백이 오지 않는다', () => {
    const onSpeechEnd = vi.fn()
    recorder.start({ onSpeechEnd })

    vi.advanceTimersByTime(NO_SPEECH_MS - 1)
    expect(onSpeechEnd).not.toHaveBeenCalled()
  })

  it('입력 없이 noSpeechMs 가 지나면 빈 텍스트로 onSpeechEnd 를 한 번 부른다 (무발화)', () => {
    const onSpeechEnd = vi.fn()
    recorder.start({ onSpeechEnd })

    vi.advanceTimersByTime(NO_SPEECH_MS)
    expect(onSpeechEnd).toHaveBeenCalledTimes(1)
    expect(onSpeechEnd).toHaveBeenCalledWith({ text: '' })

    vi.advanceTimersByTime(NO_SPEECH_MS * 3)
    expect(onSpeechEnd).toHaveBeenCalledTimes(1) // 반복하지 않는다
  })

  it('첫 입력이 오면 무발화 타이머는 해제되고, 마지막 입력 후 silenceMs 에 입력 텍스트로 onSpeechEnd 를 부른다 (무음)', () => {
    const onSpeechEnd = vi.fn()
    recorder.start({ onSpeechEnd })

    vi.advanceTimersByTime(NO_SPEECH_MS - 1)
    recorder.onInput('서울') // 무발화 만료 1ms 전에 첫 입력
    vi.advanceTimersByTime(1) // 원래 무발화 만료 시각
    expect(onSpeechEnd).not.toHaveBeenCalled() // 무발화 타이머가 해제됐다

    recorder.onInput('서울역')
    vi.advanceTimersByTime(SILENCE_MS - 1)
    expect(onSpeechEnd).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onSpeechEnd).toHaveBeenCalledTimes(1)
    expect(onSpeechEnd).toHaveBeenCalledWith({ text: '서울역' }) // 마지막 입력 텍스트
  })

  it('입력이 계속 오는 동안에는 무음 타이머가 매번 리셋되어 콜백이 오지 않는다', () => {
    const onSpeechEnd = vi.fn()
    recorder.start({ onSpeechEnd })

    const typed = ['동', '동국', '동국대', '동국대학', '동국대학교']
    for (const text of typed) {
      recorder.onInput(text)
      vi.advanceTimersByTime(SILENCE_MS - 1) // 만료 직전마다 다음 글자
    }
    expect(onSpeechEnd).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onSpeechEnd).toHaveBeenCalledWith({ text: '동국대학교' })
  })

  it('stop 뒤에는 시간이 지나도 콜백이 오지 않고 타이머도 남지 않는다', () => {
    const onSpeechEnd = vi.fn()
    recorder.start({ onSpeechEnd })
    recorder.onInput('서울역')

    recorder.stop()
    vi.advanceTimersByTime(NO_SPEECH_MS + SILENCE_MS)

    expect(onSpeechEnd).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stop 뒤에 오는 onInput 은 무시된다 (세션이 없으므로 타이머를 새로 걸지 않는다)', () => {
    const onSpeechEnd = vi.fn()
    recorder.start({ onSpeechEnd })
    recorder.stop()

    recorder.onInput('늦게 온 입력')
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(SILENCE_MS * 2)
    expect(onSpeechEnd).not.toHaveBeenCalled()
  })

  it('start 전에 오는 onInput 도 무시된다', () => {
    recorder.onInput('세션 없음')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('start 를 두 번 연속 부르면 타이머는 하나만 남고 콜백은 두 번째 것만 불린다 (StrictMode start → start)', () => {
    const first = vi.fn()
    const second = vi.fn()

    recorder.start({ onSpeechEnd: first })
    vi.advanceTimersByTime(NO_SPEECH_MS / 2)
    recorder.start({ onSpeechEnd: second }) // 이전 세션을 정리하고 새로 시작
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(NO_SPEECH_MS / 2) // 첫 번째 세션 기준이면 지금 만료
    expect(first).not.toHaveBeenCalled()
    expect(second).not.toHaveBeenCalled()

    vi.advanceTimersByTime(NO_SPEECH_MS / 2) // 두 번째 세션 기준 만료
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledWith({ text: '' })
  })

  it('start → stop → start 순서(StrictMode)에서도 타이머는 하나뿐이고 두 번째 콜백만 불린다', () => {
    const first = vi.fn()
    const second = vi.fn()

    recorder.start({ onSpeechEnd: first })
    recorder.stop()
    recorder.start({ onSpeechEnd: second })
    expect(vi.getTimerCount()).toBe(1)

    vi.advanceTimersByTime(NO_SPEECH_MS)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('새 세션을 시작하면 이전 세션의 입력 텍스트는 남지 않는다', () => {
    const first = vi.fn()
    const second = vi.fn()

    recorder.start({ onSpeechEnd: first })
    recorder.onInput('이전 입력')
    recorder.start({ onSpeechEnd: second })

    vi.advanceTimersByTime(NO_SPEECH_MS) // 새 세션은 입력이 없었으므로 무발화 경로
    expect(second).toHaveBeenCalledWith({ text: '' })
  })

  it('콜백은 세션 정리가 끝난 뒤 불린다 (콜백 안에서 stop 을 다시 불러도 이중 호출 없음)', () => {
    const onSpeechEnd = vi.fn(() => {
      recorder.stop() // LISTENING 핸들러의 dispatch → 상태 변경 → cleanup → stop() 을 흉내
    })
    recorder.start({ onSpeechEnd })

    vi.advanceTimersByTime(NO_SPEECH_MS)
    expect(onSpeechEnd).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stop 은 여러 번 불러도 안전하다 (idempotent)', () => {
    recorder.start({ onSpeechEnd: vi.fn() })
    expect(() => {
      recorder.stop()
      recorder.stop()
      recorder.stop()
    }).not.toThrow()
    expect(vi.getTimerCount()).toBe(0)
  })
})
