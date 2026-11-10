// effect 핸들러 테스트 공용 도구.
// 핸들러는 (state, dispatch, { api, recorder, config }) 를 받고 내부에서 async 함수를 "기다리지 않고" 시작한다.
// 그래서 테스트는 (1) 가짜 api·recorder 를 주입하고 (2) 비동기 작업이 끝날 때까지 흘려보낸 뒤 (3) dispatch 호출을 확인한다.

import { vi } from 'vitest'
import { initialState } from '../../state/kioskReducer.js'

/** 특정 상태에 있는 테스트용 state (reducer 테스트의 at 과 같다) */
export const at = (state, extra = {}) => ({ ...initialState, state, ...extra })

/**
 * 밀린 비동기 작업(Promise 체인, setTimeout 0)을 모두 흘려보낸다.
 * 핸들러 안의 await 가 여러 단계(stt → resolve)라도 매크로태스크 한 바퀴면 끝난다. 안전하게 두 바퀴 돈다.
 */
export async function flush() {
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => setTimeout(r, 0))
}

/**
 * 밖에서 resolve/reject 를 조종할 수 있는 Promise. "응답이 오기 전에 cleanup" 시나리오에 쓴다.
 * 사용: const d = deferred(); api.route = () => d.promise; cleanup(); d.resolve({...}); await flush()
 */
export function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * 가짜 api. 필요한 함수만 넘기면 나머지는 "부르면 안 되는" 함수로 채운다 (부르면 테스트가 실패하도록 throw).
 * 모두 vi.fn 이라 호출 횟수·인자를 확인할 수 있다.
 */
export function fakeApi(overrides = {}) {
  const names = ['health', 'stt', 'resolve', 'route', 'getPois', 'createQr']
  const api = {}
  for (const name of names) {
    api[name] = vi.fn(
      overrides[name] ??
        (() => {
          throw new Error(`테스트에서 api.${name} 은 호출되면 안 된다`)
        }),
    )
  }
  return api
}

/** 가짜 recorder. checkMic 만 쓰는 핸들러(startupCheck)용. */
export function fakeRecorder(overrides = {}) {
  return {
    checkMic: vi.fn(overrides.checkMic ?? (async () => ({ available: true }))),
    start: vi.fn(overrides.start ?? (() => {})),
    onInput: vi.fn(overrides.onInput ?? (() => {})),
    stop: vi.fn(overrides.stop ?? (() => {})),
  }
}

/** dispatch 가 받은 이벤트 type 목록 (가독성용) */
export const dispatchedTypes = (dispatch) => dispatch.mock.calls.map(([action]) => action.type)
