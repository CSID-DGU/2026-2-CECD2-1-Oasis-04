// POST /api/v1/resolve 의 실제 구현. 인식된 문장에서 목적지 후보를 받아 화면이 쓰는 모양으로 바꾼다.
//
// 서버 응답 → 화면 모양 (mock/resolve.js 와 같은 { status, needConfirm, poi, candidates })
//   intent NAVIGATE + need_confirm false → { status: 'OK', needConfirm: false, poi: 1순위, candidates }
//   intent NAVIGATE + need_confirm true  → { status: 'OK', needConfirm: true,  candidates: 최대 3개 }
//   실패 code NO_CANDIDATE               → { status: 'NOT_UNDERSTOOD' }
//   실패 code OUT_OF_SCOPE               → { status: 'OUT_OF_SCOPE' }   (서울 밖 지명 등 안내 범위 밖)
//   intent 가 길찾기가 아님              → { status: 'NOT_UNDERSTOOD' }
//       (서버는 '네/아니요/그만/다시' 도 구분해 주지만, 지금 워크플로우에는 듣는 중에 그 말을 받는 전이가 없다.
//        목적지를 묻는 화면에서 목적지가 아닌 말을 한 것이므로 못 알아들은 것으로 본다. intent 는 결과에 실어 둔다)
//   그 밖의 실패                          → Error(서버의 쉬운 문장)
//   빈 문장                               → 서버를 부르지 않고 { status: 'NOT_UNDERSTOOD' }
//
// 결과에 transcript(서버가 해석한 문장)를 함께 실어 둔다. 실제 마이크에서는 reducer 의 transcript 가 비어 있어서
// 확인 화면이 "들은 말" 을 보여 주려면 이 값이 필요하다.

import { apiFetch, errorMessageOf, KIOSK_ID } from './http.js'
import { toPoi } from './poi.js'

export async function resolve(text) {
  const query = (text ?? '').trim()
  if (query === '') return { status: 'NOT_UNDERSTOOD' }

  const body = await apiFetch('/resolve', {
    method: 'POST',
    json: { text: query, kiosk_id: KIOSK_ID, input_mode: 'VOICE' },
  })

  if (!body.success) {
    const code = body.error?.code
    if (code === 'NO_CANDIDATE') return { status: 'NOT_UNDERSTOOD', transcript: query }
    if (code === 'OUT_OF_SCOPE') return { status: 'OUT_OF_SCOPE', transcript: query }
    throw new Error(errorMessageOf(body, 'SERVER_ERROR'))
  }

  const d = body.data ?? {}
  const candidates = (d.destination_candidates ?? []).map(toPoi)
  if (d.intent !== 'NAVIGATE' || candidates.length === 0) {
    return { status: 'NOT_UNDERSTOOD', transcript: query, intent: d.intent ?? null }
  }
  if (d.need_confirm) {
    return { status: 'OK', needConfirm: true, candidates, confirmText: d.confirm_text ?? null, transcript: query }
  }
  return { status: 'OK', needConfirm: false, poi: candidates[0], candidates, transcript: query }
}
