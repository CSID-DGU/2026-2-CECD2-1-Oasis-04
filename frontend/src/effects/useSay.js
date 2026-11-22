// 화면이 열릴 때 문장을 읽어 주는 훅. 읽을 문장은 화면이 view/speechText.js 로 만들어 넘긴다.
//   useSay(confirmSpeech({ candidates, question }))
// 문장이 바뀌면(다른 경로를 고름, QR 이 만들어짐) 새로 읽고, 화면을 떠나면 멈춘다.
// 문장 내용이 같으면 화면이 다시 그려져도 다시 읽지 않는다 (배열이 아니라 글 내용으로 비교한다).

import { useEffect } from 'react'
import { voiceGuide } from './voiceGuide.js'

export function useSay(lines, guide = voiceGuide) {
  const text = (lines ?? []).filter(Boolean).join('\n')
  useEffect(() => {
    if (!text) return undefined
    guide.say(text.split('\n'))
    return () => guide.clear()
  }, [text, guide])
}
