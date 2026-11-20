// 서버와 통신하는 유일한 입구. 화면·effect 는 항상 여기서 api 를 가져다 쓴다.
// STT 서버와 연동하면 real, 아니면 mock 구현을 고른다.
// (Spring 의 @Profile 로 같은 인터페이스의 빈을 바꿔 끼우는 것과 같은 역할)
//
// 연동 여부는 settings/integration.js 가 앱을 그리기 전에 정한다:
//   연습 모드(VITE_USE_MOCK=true)는 꺼짐, 실제 모드는 STT 서버가 응답하면 켜짐·응답하지 않으면 꺼짐,
//   설정 페이지(주소 끝에 #settings)에서 켜기·끄기로 고정할 수 있다. 시연 모드는 늘 꺼짐.

import * as mock from './mock/index.js'
import * as real from './real/index.js'
import { getIntegration } from '../settings/integration.js'

export const USE_MOCK = !getIntegration().linked

export const api = USE_MOCK ? mock : real

if (import.meta.env.DEV) {
  console.log(`[api] ${USE_MOCK ? 'mock' : 'real'} 구현 사용 (${getIntegration().reason}, VITE_USE_MOCK=${import.meta.env.VITE_USE_MOCK})`)
}
