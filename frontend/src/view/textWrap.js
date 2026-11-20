// 긴 글의 줄 바꿈 (디자인 문서 6절 카드 이름 규칙, 10-2절 긴 글 규칙).
//   띄어쓰기가 있으면 띄어쓰기에서만 바꾼다 ("국립현대미술관 / 서울관")
//   한 단어면 글자 사이에서 바꾼다 ("동대문역사 / 문화공원역")
//   둘 다 줄 길이를 고르게 (text-wrap: balance, global.css 의 .wrap-even)
// 5단계 고르는 카드도 같은 함수를 쓴다.

/** 글에 띄어쓰기가 있는가 (앞뒤 공백은 빼고 본다) */
export function hasSpace(text) {
  return typeof text === 'string' && /\s/.test(text.trim())
}

/** 고르게 줄을 바꾸는 클래스 이름. 띄어쓰기가 있으면 띄어쓰기에서만 바꾸는 클래스를 더한다 */
export function evenWrapClass(text) {
  return hasSpace(text) ? 'wrap-even is-keep-all' : 'wrap-even'
}
