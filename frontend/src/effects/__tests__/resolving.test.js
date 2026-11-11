// RESOLVING 핸들러 테스트 (계획서 Phase 6-2).
// api.stt → api.resolve 응답이 표의 이벤트 넷(RESOLVE_CONFIRMED / RESOLVE_NEED_CONFIRM / RESOLVE_NOT_UNDERSTOOD /
// RESOLVE_OUT_OF_SCOPE_OR_ERROR) 중 어느 것으로 바뀌는지, state.transcript 가 api 에 그대로 전달되는지,
// cleanup 뒤에는 dispatch 하지 않는지(StrictMode 규칙) 확인한다.
// 환경: node (document 불필요)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolvingHandler } from '../handlers/resolving.js'
import { STATES } from '../../state/states.js'
import { EVENTS } from '../../state/events.js'
import { at, flush, deferred, fakeApi, dispatchedTypes } from './helpers.js'

const POI = { id: 'poi-seoul-station', name: '서울역', category: '지하철역' }
const CANDIDATES = [
  { id: 'poi-hospital-a', name: '동국대병원', category: '병원' },
  { id: 'poi-hospital-b', name: '서울병원', category: '병원' },
]

/** stt 는 받은 텍스트를 그대로 돌려주고, resolve 는 주어진 응답을 돌려주는 가짜 api 로 핸들러를 끝까지 돌린다 */
async function run({ transcript = '서울역', resolveResult, stt, resolve }) {
  const dispatch = vi.fn()
  const api = fakeApi({
    stt: stt ?? (async ({ text }) => ({ text })),
    resolve: resolve ?? (async () => resolveResult),
  })
  const cleanup = resolvingHandler(at(STATES.RESOLVING, { transcript }), dispatch, { api })
  await flush()
  cleanup()
  return { dispatch, api }
}

describe('resolvingHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('status OK + needConfirm false 면 RESOLVE_CONFIRMED 를 resolve 응답과 함께 dispatch 한다', async () => {
    const resolveResult = { status: 'OK', needConfirm: false, poi: POI }
    const { dispatch } = await run({ resolveResult })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.RESOLVE_CONFIRMED, resolve: resolveResult })
  })

  it('status OK + needConfirm true 면 RESOLVE_NEED_CONFIRM 을 후보 목록과 함께 dispatch 한다', async () => {
    const resolveResult = { status: 'OK', needConfirm: true, candidates: CANDIDATES }
    const { dispatch } = await run({ transcript: '병원', resolveResult })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.RESOLVE_NEED_CONFIRM, resolve: resolveResult })
  })

  it('status NOT_UNDERSTOOD 면 RESOLVE_NOT_UNDERSTOOD 를 payload 없이 dispatch 한다', async () => {
    const { dispatch } = await run({ transcript: '웅얼', resolveResult: { status: 'NOT_UNDERSTOOD' } })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.RESOLVE_NOT_UNDERSTOOD })
  })

  it('빈 텍스트(10초 무발화)도 그대로 api 에 보내고, NOT_UNDERSTOOD 응답이면 RESOLVE_NOT_UNDERSTOOD 를 dispatch 한다', async () => {
    const { dispatch, api } = await run({ transcript: '', resolveResult: { status: 'NOT_UNDERSTOOD' } })
    expect(api.stt).toHaveBeenCalledWith({ text: '' })
    expect(api.resolve).toHaveBeenCalledWith('')
    expect(dispatchedTypes(dispatch)).toEqual([EVENTS.RESOLVE_NOT_UNDERSTOOD])
  })

  it('status OUT_OF_SCOPE 면 RESOLVE_OUT_OF_SCOPE_OR_ERROR 를 사용자용 문장(error)과 함께 dispatch 한다', async () => {
    const { dispatch } = await run({ transcript: '하와이', resolveResult: { status: 'OUT_OF_SCOPE' } })
    expect(dispatch).toHaveBeenCalledTimes(1)
    const action = dispatch.mock.calls[0][0]
    expect(action.type).toBe(EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR)
    expect(action.error).toBeTypeOf('string')
    expect(action.error.length).toBeGreaterThan(0)
  })

  it('표에 없는 status 가 오면 RESOLVE_OUT_OF_SCOPE_OR_ERROR 로 처리하고 경고를 남긴다', async () => {
    const { dispatch } = await run({ resolveResult: { status: 'SOMETHING_NEW' } })
    expect(dispatchedTypes(dispatch)).toEqual([EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR])
    expect(console.warn).toHaveBeenCalled()
  })

  it('stt() 가 throw 하면 RESOLVE_OUT_OF_SCOPE_OR_ERROR 를 오류 메시지와 함께 dispatch 하고 resolve() 는 부르지 않는다', async () => {
    const { dispatch, api } = await run({
      stt: async () => {
        throw new Error('STT_ERROR')
      },
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR, error: 'STT_ERROR' })
    expect(api.resolve).not.toHaveBeenCalled()
  })

  it('resolve() 가 throw 하면 RESOLVE_OUT_OF_SCOPE_OR_ERROR 를 오류 메시지와 함께 dispatch 한다', async () => {
    const { dispatch } = await run({
      resolve: async () => {
        throw new Error('SERVER_ERROR')
      },
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.RESOLVE_OUT_OF_SCOPE_OR_ERROR, error: 'SERVER_ERROR' })
  })

  it('state.transcript 가 stt 에 { text } 로, stt 결과 텍스트가 resolve 에 그대로 전달된다', async () => {
    const { api } = await run({
      transcript: '동국대학교 가고 싶어요',
      stt: async ({ text }) => ({ text: `[정제됨] ${text}` }),
      resolveResult: { status: 'OK', needConfirm: false, poi: POI },
    })
    expect(api.stt).toHaveBeenCalledTimes(1)
    expect(api.stt).toHaveBeenCalledWith({ text: '동국대학교 가고 싶어요' })
    expect(api.resolve).toHaveBeenCalledTimes(1)
    expect(api.resolve).toHaveBeenCalledWith('[정제됨] 동국대학교 가고 싶어요') // stt 가 돌려준 텍스트를 쓴다
  })

  it('stt 응답이 오기 전에 cleanup 하면 resolve 도 부르지 않고 dispatch 도 하지 않는다 (StrictMode 규칙)', async () => {
    const sttDeferred = deferred()
    const dispatch = vi.fn()
    const api = fakeApi({
      stt: () => sttDeferred.promise,
      resolve: async () => ({ status: 'OK', needConfirm: false, poi: POI }),
    })

    const cleanup = resolvingHandler(at(STATES.RESOLVING, { transcript: '서울역' }), dispatch, { api })
    cleanup()
    sttDeferred.resolve({ text: '서울역' })
    await flush()

    expect(api.resolve).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('resolve 응답이 오기 전에 cleanup 하면 dispatch 하지 않는다 (StrictMode 규칙)', async () => {
    const resolveDeferred = deferred()
    const dispatch = vi.fn()
    const api = fakeApi({
      stt: async ({ text }) => ({ text }),
      resolve: () => resolveDeferred.promise,
    })

    const cleanup = resolvingHandler(at(STATES.RESOLVING, { transcript: '서울역' }), dispatch, { api })
    await new Promise((r) => setTimeout(r, 0)) // stt 는 끝나고 resolve 를 기다리는 중
    expect(api.resolve).toHaveBeenCalledTimes(1)
    cleanup()
    resolveDeferred.resolve({ status: 'OK', needConfirm: false, poi: POI })
    await flush()

    expect(dispatch).not.toHaveBeenCalled()
  })
})
