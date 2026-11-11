// STARTUP_CHECK 핸들러 테스트 (계획서 Phase 6-2).
// api.health() 와 recorder.checkMic() 결과 조합이 표의 이벤트 셋(HEALTH_OK / HEALTH_SERVER_DOWN / MIC_OR_STT_UNAVAILABLE) 중
// 어느 것으로 바뀌는지, 서버 불가가 마이크 불가보다 우선인지(계획서 6절 9번), cleanup 뒤에는 dispatch 하지 않는지(StrictMode 규칙) 확인한다.
// 환경: node (document 불필요)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { startupCheckHandler } from '../handlers/startupCheck.js'
import { STATES } from '../../state/states.js'
import { EVENTS } from '../../state/events.js'
import { at, flush, deferred, fakeApi, fakeRecorder, dispatchedTypes } from './helpers.js'

const state = at(STATES.STARTUP_CHECK)

/** health 응답과 checkMic 응답을 주고 핸들러를 끝까지 돌린 뒤 dispatch 를 돌려준다 */
async function run({ health, checkMic }) {
  const dispatch = vi.fn()
  const api = fakeApi({ health })
  const recorder = fakeRecorder({ checkMic })
  const cleanup = startupCheckHandler(state, dispatch, { api, recorder })
  await flush()
  cleanup()
  return { dispatch, api, recorder }
}

describe('startupCheckHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('서버·STT·마이크가 모두 정상이면 HEALTH_OK 를 health 정보와 함께 dispatch 한다', async () => {
    const { dispatch, api, recorder } = await run({
      health: async () => ({ server: true, stt: true }),
      checkMic: async () => ({ available: true }),
    })
    expect(api.health).toHaveBeenCalledTimes(1)
    expect(recorder.checkMic).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.HEALTH_OK, health: { server: true, mic: true, stt: true } })
  })

  it('서버가 불가(server: false)면 HEALTH_SERVER_DOWN 을 dispatch 한다', async () => {
    const { dispatch } = await run({
      health: async () => ({ server: false, stt: true }),
      checkMic: async () => ({ available: true }),
    })
    expect(dispatchedTypes(dispatch)).toEqual([EVENTS.HEALTH_SERVER_DOWN])
    expect(dispatch.mock.calls[0][0].health.server).toBe(false)
  })

  it('STT 가 불가(stt: false)면 MIC_OR_STT_UNAVAILABLE 을 dispatch 한다', async () => {
    const { dispatch } = await run({
      health: async () => ({ server: true, stt: false }),
      checkMic: async () => ({ available: true }),
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: EVENTS.MIC_OR_STT_UNAVAILABLE,
      health: { server: true, mic: true, stt: false },
    })
  })

  it('마이크가 불가(available: false)면 MIC_OR_STT_UNAVAILABLE 을 dispatch 한다', async () => {
    const { dispatch } = await run({
      health: async () => ({ server: true, stt: true }),
      checkMic: async () => ({ available: false }),
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: EVENTS.MIC_OR_STT_UNAVAILABLE,
      health: { server: true, mic: false, stt: true },
    })
  })

  it('checkMic() 이 throw 하면 마이크 없음으로 보고 MIC_OR_STT_UNAVAILABLE 을 dispatch 한다', async () => {
    const { dispatch } = await run({
      health: async () => ({ server: true, stt: true }),
      checkMic: async () => {
        throw new Error('MIC_PERMISSION_DENIED')
      },
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: EVENTS.MIC_OR_STT_UNAVAILABLE,
      health: { server: true, mic: false, stt: true },
    })
  })

  it('서버 불가와 마이크 불가가 동시에 나면 서버 불가가 우선이라 HEALTH_SERVER_DOWN 만 dispatch 한다', async () => {
    const { dispatch } = await run({
      health: async () => ({ server: false, stt: false }),
      checkMic: async () => ({ available: false }),
    })
    expect(dispatchedTypes(dispatch)).toEqual([EVENTS.HEALTH_SERVER_DOWN])
  })

  it('health() 가 throw 하면 HEALTH_SERVER_DOWN 을 dispatch 한다 (마이크가 정상이어도)', async () => {
    const { dispatch } = await run({
      health: async () => {
        throw new Error('NETWORK_ERROR')
      },
      checkMic: async () => ({ available: true }),
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      type: EVENTS.HEALTH_SERVER_DOWN,
      health: { server: false, mic: null, stt: null },
    })
  })

  it('응답이 오기 전에 cleanup 하면 응답이 와도 dispatch 하지 않는다 (StrictMode 규칙)', async () => {
    const healthDeferred = deferred()
    const dispatch = vi.fn()
    const api = fakeApi({ health: () => healthDeferred.promise })
    const recorder = fakeRecorder()

    const cleanup = startupCheckHandler(state, dispatch, { api, recorder })
    cleanup() // 응답 전에 상태를 떠남 (StrictMode 1차 실행 cleanup, DEV_RESET 등)
    healthDeferred.resolve({ server: true, stt: true })
    await flush()

    expect(api.health).toHaveBeenCalledTimes(1) // 호출 자체는 한 번 나갔지만
    expect(dispatch).not.toHaveBeenCalled() // 결과는 버린다
  })
})
