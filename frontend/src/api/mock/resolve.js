// POST /resolve 의 mock. 계획서 4절. 입력 텍스트의 키워드로 분기한다.
//   ''  또는 '웅얼' 포함      → { status: 'NOT_UNDERSTOOD' }
//   '하와이' 포함             → { status: 'OUT_OF_SCOPE' }
//   '에러' 포함               → Error('SERVER_ERROR')
//   '병원' 포함               → { status: 'OK', needConfirm: true, candidates: 병원 3개 }
//   목적지 이름과 정확히 일치 → { status: 'OK', needConfirm: false, poi }
//   그 외                     → { status: 'NOT_UNDERSTOOD' }  (모르는 말은 못 알아들은 것으로)
// 우선순위는 위에서 아래 순서다 ('병원 에러' 처럼 겹치면 먼저 걸리는 규칙이 이긴다).

import { mockDelay } from './mockDelay.js'
import { POIS } from './data/pois.js'

export async function resolve(text) {
  const query = (text ?? '').trim()
  console.log('[mock] resolve 호출', JSON.stringify(query))
  await mockDelay()

  if (query === '' || query.includes('웅얼')) return { status: 'NOT_UNDERSTOOD' }
  if (query.includes('하와이')) return { status: 'OUT_OF_SCOPE' }
  if (query.includes('에러')) throw new Error('SERVER_ERROR')
  if (query.includes('병원')) {
    const candidates = POIS.filter((p) => p.category === '병원')
    return { status: 'OK', needConfirm: true, candidates }
  }

  const poi = POIS.find((p) => p.name === query)
  if (poi) return { status: 'OK', needConfirm: false, poi }

  return { status: 'NOT_UNDERSTOOD' }
}
