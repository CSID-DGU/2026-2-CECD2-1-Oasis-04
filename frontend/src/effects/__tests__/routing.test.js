// ROUTING 핸들러 테스트 (계획서 Phase 6-2).
// api.route 응답이 표의 이벤트 둘(ROUTE_FOUND / ROUTE_FAILED) 중 어느 것으로 바뀌는지,
// selectedPoi 가 없으면 api 를 부르지 않고 실패 처리하는지, cleanup 뒤에는 dispatch 하지 않는지(StrictMode 규칙) 확인한다.
// 환경: node (document 불필요)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { routingHandler } from '../handlers/routing.js'
import { STATES } from '../../state/states.js'
import { EVENTS } from '../../state/events.js'
import { at, flush, deferred, fakeApi, dispatchedTypes } from './helpers.js'

const POI = { id: 'poi-seoul-station', name: '서울역', category: '지하철역' }
const ROUTES = [
  { id: 'r1', rank: 1, summary: '4호선 → 1호선', durationMin: 25, transfers: 1 },
  { id: 'r2', rank: 2, summary: '버스 100번', durationMin: 35, transfers: 0 },
]

/** selectedPoi 가 있는 state 로 핸들러를 끝까지 돌린다 */
async function run({ route, selectedPoi = POI }) {
  const dispatch = vi.fn()
  const api = fakeApi({ route })
  const cleanup = routingHandler(at(STATES.ROUTING, { selectedPoi }), dispatch, { api })
  await flush()
  cleanup()
  return { dispatch, api }
}

describe('routingHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('경로가 1개 이상이면 ROUTE_FOUND 를 routes 와 함께 dispatch 한다', async () => {
    const { dispatch, api } = await run({ route: async () => ({ routes: ROUTES }) })
    expect(api.route).toHaveBeenCalledTimes(1)
    expect(api.route).toHaveBeenCalledWith(POI.id) // poi 객체가 아니라 id 를 보낸다
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.ROUTE_FOUND, routes: ROUTES })
  })

  it('경로가 빈 배열이면 ROUTE_FAILED 를 사용자용 문장(error)과 함께 dispatch 한다', async () => {
    const { dispatch } = await run({ route: async () => ({ routes: [] }) })
    expect(dispatch).toHaveBeenCalledTimes(1)
    const action = dispatch.mock.calls[0][0]
    expect(action.type).toBe(EVENTS.ROUTE_FAILED)
    expect(action.error).toBeTypeOf('string')
    expect(action.error.length).toBeGreaterThan(0)
  })

  it('routes 필드가 배열이 아니면(형식 불일치) ROUTE_FAILED 로 처리한다', async () => {
    const { dispatch } = await run({ route: async () => ({}) })
    expect(dispatchedTypes(dispatch)).toEqual([EVENTS.ROUTE_FAILED])
  })

  it('route() 가 throw 하면 ROUTE_FAILED 를 오류 메시지와 함께 dispatch 한다', async () => {
    const { dispatch } = await run({
      route: async () => {
        throw new Error('ROUTE_ERROR')
      },
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: EVENTS.ROUTE_FAILED, error: 'ROUTE_ERROR' })
  })

  it('selectedPoi 가 없으면 api.route 를 한 번도 부르지 않고 ROUTE_FAILED 를 dispatch 한다', async () => {
    const { dispatch, api } = await run({ route: async () => ({ routes: ROUTES }), selectedPoi: null })
    expect(api.route).toHaveBeenCalledTimes(0)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0][0].type).toBe(EVENTS.ROUTE_FAILED)
  })

  it('selectedPoi 는 있지만 id 가 없어도 api.route 를 부르지 않고 ROUTE_FAILED 를 dispatch 한다', async () => {
    const { dispatch, api } = await run({ route: async () => ({ routes: ROUTES }), selectedPoi: { name: 'id 없는 poi' } })
    expect(api.route).toHaveBeenCalledTimes(0)
    expect(dispatchedTypes(dispatch)).toEqual([EVENTS.ROUTE_FAILED])
  })

  it('selectedPoi 없음 경로에서도 dispatch 전에 cleanup 하면 dispatch 하지 않는다 (StrictMode 1차 실행 대응)', async () => {
    const dispatch = vi.fn()
    const api = fakeApi()
    const cleanup = routingHandler(at(STATES.ROUTING, { selectedPoi: null }), dispatch, { api })
    cleanup() // setTimeout(…, 0) 이 돌기 전에 취소
    await flush()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('route 응답이 오기 전에 cleanup 하면 응답이 와도 dispatch 하지 않는다 (StrictMode 규칙)', async () => {
    const routeDeferred = deferred()
    const dispatch = vi.fn()
    const api = fakeApi({ route: () => routeDeferred.promise })

    const cleanup = routingHandler(at(STATES.ROUTING, { selectedPoi: POI }), dispatch, { api })
    cleanup()
    routeDeferred.resolve({ routes: ROUTES })
    await flush()

    expect(api.route).toHaveBeenCalledTimes(1)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('route 가 응답 전에 cleanup 된 뒤 reject 되어도 dispatch 하지 않는다', async () => {
    const routeDeferred = deferred()
    const dispatch = vi.fn()
    const api = fakeApi({ route: () => routeDeferred.promise })

    const cleanup = routingHandler(at(STATES.ROUTING, { selectedPoi: POI }), dispatch, { api })
    cleanup()
    routeDeferred.reject(new Error('ROUTE_ERROR'))
    await flush()

    expect(dispatch).not.toHaveBeenCalled()
  })
})
