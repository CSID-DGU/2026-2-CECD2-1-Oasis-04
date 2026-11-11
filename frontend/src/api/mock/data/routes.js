// 가짜 경로 3개. 1순위가 첫 번째. 어느 poi 를 골라도 같은 3개를 돌려준다 (poi-no-route 제외).
// Route 구조는 백엔드와 합의 전이므로 계획서 7절 가정대로 최소 필드만 둔다.

export const ROUTES = Object.freeze([
  { id: 'route-1', rank: 1, summary: '지하철 3호선 → 4호선', durationMin: 25, transfers: 1 },
  { id: 'route-2', rank: 2, summary: '버스 100번', durationMin: 32, transfers: 0 },
  { id: 'route-3', rank: 3, summary: '지하철 3호선 → 버스 200번', durationMin: 35, transfers: 1 },
])
