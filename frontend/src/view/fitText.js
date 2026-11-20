// 넘치는 글씨를 정한 단계씩 줄이는 계산 (디자인 문서 10-2절: 112px 에서 8px 씩 72px 까지, 7절 띠 이름도 같은 규칙).
// 측정은 하지 않는다. fits(size) 가 "그 크기로 들어가는가" 를 알려 주면 들어가는 가장 큰 크기를 돌려준다.
// 끝까지 줄여도 넘치면 min 을 돌려준다 (더 줄이지 않는다. 그 너머는 시안처럼 자르지 않고 둔다).

export function fitSize({ start, min, step, fits }) {
  let size = start
  while (size > min && !fits(size)) size = Math.max(min, size - step)
  return size
}
