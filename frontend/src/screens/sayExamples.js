// 말하기 예시 문구 (디자인 문서 8-2절 IDLE 세 줄, 12-2절 REASKING 은 첫 줄 하나. 시안 idle-final-*.html, reasking-final.html).
// 따옴표 없이 적는다. SayExamples 부품이 따옴표를 붙인다.
export const SAY_EXAMPLES = Object.freeze(['명동 어떻게 가요?', '서울역 가는 버스', '가까운 병원'])

/** REASKING 은 한 줄만 (세 줄이면 칸 아래로 넘친다, 12-2절) */
export const REASK_EXAMPLES = Object.freeze(SAY_EXAMPLES.slice(0, 1))

/** REASKING: 들은 말이 이 줄 수 이상이면 예시를 숨긴다 (예시가 화면 아래를 넘는다, 12-2절 2026-11-19) */
export const HIDE_EXAMPLES_AT_HEARD_LINES = 3
