// 서버와 통신하는 유일한 입구. 화면·effect 는 항상 여기서 api 를 가져다 쓴다.
// VITE_USE_MOCK 이 'true' 면 mock, 아니면 real 구현을 고른다.
// (Spring 의 @Profile 로 같은 인터페이스의 빈을 바꿔 끼우는 것과 같은 역할)
// 실제 API 로 바꿀 때는 real/*.js 를 채우고 .env.production 의 VITE_USE_MOCK 만 false 로 바꾸면 된다.

import * as mock from './mock/index.js'
import * as real from './real/index.js'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export const api = USE_MOCK ? mock : real

if (import.meta.env.DEV) {
  console.log(`[api] ${USE_MOCK ? 'mock' : 'real'} 구현 사용 (VITE_USE_MOCK=${import.meta.env.VITE_USE_MOCK})`)
}
