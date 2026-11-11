// GET /api/v1/health 의 실제 구현.
// 서버 응답(data.stt.loaded, data.knowledge_base.loaded)을 화면이 쓰는 { server, stt } 로 바꾼다.
//   서버에 닿지 않음            → apiFetch 가 throw → STARTUP_CHECK 핸들러가 HEALTH_SERVER_DOWN 으로 처리
//   서버는 살아 있고 모델 준비 전 → { server: true, stt: false } → MIC_OR_STT_UNAVAILABLE (손으로 고르기만 가능)
//   모두 준비                   → { server: true, stt: true }
// 음성 모델과 장소 지식베이스가 둘 다 올라와야 말로 길찾기를 할 수 있으므로 둘을 묶어 stt 로 본다.

import { apiFetch } from './http.js'

export async function health() {
  const body = await apiFetch('/health', { timeoutMs: 5000 })
  if (!body.success) return { server: false, stt: false }
  const d = body.data ?? {}
  return { server: true, stt: Boolean(d.stt?.loaded && d.knowledge_base?.loaded) }
}
