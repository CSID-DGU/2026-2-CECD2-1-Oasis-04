// mock 구현 7개를 한 곳에 모은다. api/index.js 가 이 모듈 전체를 api 로 내보낸다.
// 함수 이름·시그니처는 real/index.js 와 반드시 같아야 한다 (같은 인터페이스의 두 구현).

export { health } from './health.js'
export { stt } from './stt.js'
export { resolve } from './resolve.js'
export { route } from './route.js'
export { getPois } from './pois.js'
export { createQr } from './qr.js'
export { getLocation } from './location.js'
