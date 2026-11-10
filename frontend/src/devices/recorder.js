// 브라우저 장치(마이크)를 쓰는 유일한 입구. effect 와 화면은 항상 여기서 recorder 를 가져다 쓴다.
// api/index.js 와 같은 방식으로 VITE_USE_MOCK 을 보고 mock/real 을 고른다.
// 서버 통신(api/)과 분리한 이유: 마이크는 서버가 아니라 브라우저 장치라서 실제 구현 시점과 방식이 다르다.
// 백엔드가 준비돼도 마이크 mock 은 유지할 수 있고, 그 반대도 가능하다.

import * as mock from './mockRecorder.js'
import * as real from './realRecorder.js'
import { USE_MOCK } from '../api/index.js'

export const recorder = USE_MOCK ? mock : real
