// POST /stt 의 mock. 계획서 4절.
// 실제로는 녹음 파일을 보내지만, mockRecorder 가 음성 대신 { text } 를 넘겨주므로 그대로 돌려준다.
//   { text: '…에러…' } → Error('STT_ERROR')   (RESOLVING 핸들러가 RESOLVE_OUT_OF_SCOPE_OR_ERROR 로 바꾼다)
//   { text: '' }       → { text: '' }         (10초 무발화. resolve('') 가 NOT_UNDERSTOOD 로 처리)

import { mockDelay } from './mockDelay.js'

export async function stt(audio) {
  const text = audio?.text ?? ''
  console.log('[mock] stt 호출', JSON.stringify(text))
  await mockDelay()

  if (text.includes('에러')) throw new Error('STT_ERROR')
  return { text }
}
