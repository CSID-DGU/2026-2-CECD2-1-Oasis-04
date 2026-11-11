// 전이 표·상수 테스트. 기준은 docs/kiosk-workflow.md 의 상태 전이 표다.
// 계획서(docs/frontend-plan.md) Phase 2-4 항목:
//   - transitions 항목 총합 40, 모든 키가 STATES 에, 모든 이벤트가 EVENTS 에 있는지
//   - STATES 14개, EVENTS 26개
//   - GO_HOME 이 정확히 7개 상태, INACTIVITY_TIMEOUT 이 정확히 6개 상태에 있고 모두 IDLE 로 가는지
// 추가로 문서의 표를 직접 읽어 코드와 한 행씩 대조한다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { STATES, CHOICE_STATES, HOME_BUTTON_STATES, INACTIVITY_STATES } from '../states.js'
import { EVENTS, DEV_EVENTS } from '../events.js'
import { transitions, nextStateOf } from '../transitions.js'

const stateValues = Object.values(STATES)
const eventValues = Object.values(EVENTS)

/** transitions 를 [{ from, event, to }] 로 펼친다 */
const flatTransitions = Object.entries(transitions).flatMap(([from, row]) =>
  Object.entries(row).map(([event, to]) => ({ from, event, to })),
)

describe('상수 개수', () => {
  it('STATES 는 14개 (화면 12 + 판단 노드 2)', () => {
    expect(stateValues).toHaveLength(14)
    expect(new Set(stateValues).size).toBe(14) // 중복 없음
  })

  it('EVENTS 는 26개 (APP_START 제외)', () => {
    expect(eventValues).toHaveLength(26)
    expect(new Set(eventValues).size).toBe(26)
    expect(eventValues).not.toContain('APP_START')
  })

  it('상수 키와 값이 같은 문자열이다 (문서 이름 그대로)', () => {
    for (const [key, value] of Object.entries(STATES)) expect(value).toBe(key)
    for (const [key, value] of Object.entries(EVENTS)) expect(value).toBe(key)
  })

  it('DEV_RESET 은 EVENTS 가 아니라 DEV_EVENTS 에만 있다', () => {
    expect(DEV_EVENTS.DEV_RESET).toBe('DEV_RESET')
    expect(eventValues).not.toContain('DEV_RESET')
  })

  it('판단 노드는 STARTUP_CHECK, FAIL_COUNT_CHECK 둘뿐이다', () => {
    expect(CHOICE_STATES).toEqual([STATES.STARTUP_CHECK, STATES.FAIL_COUNT_CHECK])
  })
})

describe('전이 표 무결성', () => {
  it('항목 총합은 40 (문서 41행 − APP_START 1)', () => {
    expect(flatTransitions).toHaveLength(40)
  })

  it('모든 현재 상태 키가 STATES 에 있다', () => {
    for (const from of Object.keys(transitions)) expect(stateValues).toContain(from)
  })

  it('모든 다음 상태가 STATES 에 있다', () => {
    for (const { to } of flatTransitions) expect(stateValues).toContain(to)
  })

  it('모든 이벤트가 EVENTS 에 있다', () => {
    for (const { event } of flatTransitions) expect(eventValues).toContain(event)
  })

  it('EVENTS 의 모든 이벤트가 표에 한 번 이상 쓰인다 (안 쓰는 상수 없음)', () => {
    const used = new Set(flatTransitions.map((t) => t.event))
    for (const event of eventValues) expect(used.has(event), `${event} 미사용`).toBe(true)
  })

  it('14개 상태 모두 나가는 전이가 있다 (막다른 상태 없음)', () => {
    for (const state of stateValues) {
      expect(Object.keys(transitions[state] ?? {}).length, `${state} 에 나가는 전이 없음`).toBeGreaterThan(0)
    }
  })

  it('nextStateOf 는 표에 있으면 다음 상태, 없으면 undefined', () => {
    expect(nextStateOf(STATES.IDLE, EVENTS.MIC_BUTTON_PRESSED)).toBe(STATES.LISTENING)
    expect(nextStateOf(STATES.IDLE, EVENTS.ROUTE_FOUND)).toBeUndefined()
    expect(nextStateOf('NO_SUCH_STATE', EVENTS.GO_HOME)).toBeUndefined()
  })
})

describe('IDLE 복귀 전이 (2026-11-09 회의 확정)', () => {
  const rowsWith = (event) => flatTransitions.filter((t) => t.event === event)

  it('GO_HOME 은 정확히 7개 상태에 있고 모두 IDLE 로 간다', () => {
    const rows = rowsWith(EVENTS.GO_HOME)
    expect(rows).toHaveLength(7)
    expect(rows.map((r) => r.from).sort()).toEqual([...HOME_BUTTON_STATES].sort())
    for (const { to } of rows) expect(to).toBe(STATES.IDLE)
  })

  it('INACTIVITY_TIMEOUT 은 정확히 6개 상태에 있고 모두 IDLE 로 간다', () => {
    const rows = rowsWith(EVENTS.INACTIVITY_TIMEOUT)
    expect(rows).toHaveLength(6)
    expect(rows.map((r) => r.from).sort()).toEqual([...INACTIVITY_STATES].sort())
    for (const { to } of rows) expect(to).toBe(STATES.IDLE)
  })

  it('INACTIVITY_TIMEOUT 상태 6곳 = GO_HOME 상태 7곳 − LISTENING', () => {
    const expected = HOME_BUTTON_STATES.filter((s) => s !== STATES.LISTENING)
    expect([...INACTIVITY_STATES].sort()).toEqual([...expected].sort())
  })

  it('LISTEN_CANCEL 은 LISTENING 에서만 IDLE 로 간다', () => {
    expect(rowsWith(EVENTS.LISTEN_CANCEL)).toEqual([
      { from: STATES.LISTENING, event: EVENTS.LISTEN_CANCEL, to: STATES.IDLE },
    ])
  })

  it('스피너 화면과 IDLE·IDLE_REDUCED 에는 GO_HOME 이 없다', () => {
    const noHome = [
      STATES.STARTUP_CHECK,
      STATES.CHECKING,
      STATES.RESOLVING,
      STATES.ROUTING,
      STATES.FAIL_COUNT_CHECK,
      STATES.IDLE,
      STATES.IDLE_REDUCED,
    ]
    for (const state of noHome) expect(transitions[state][EVENTS.GO_HOME]).toBeUndefined()
  })
})

describe('docs/kiosk-workflow.md 표와 1:1 대조', () => {
  const docPath = fileURLToPath(new URL('../../../../docs/kiosk-workflow.md', import.meta.url))
  const markdown = readFileSync(docPath, 'utf8')

  // 표 행 형식: | `현재 상태` | `이벤트` | `다음 상태` | ...
  // APP_START 행만 첫 칸이 `[*]` (앱 시작) 이라 첫 칸 뒤에 설명이 붙는다.
  const docRows = []
  let appStartRow = null
  for (const line of markdown.split('\n')) {
    const m = line.match(/^\| `([^`]+)`[^|]*\| `([^`]+)` \| `([^`]+)` \|/)
    if (!m) continue
    const [, from, event, to] = m
    if (event === 'APP_START') appStartRow = { from, event, to }
    else docRows.push({ from, event, to })
  }

  it('문서 표는 41행 (APP_START 1 + 나머지 40)', () => {
    expect(appStartRow).toEqual({ from: '[*]', event: 'APP_START', to: STATES.STARTUP_CHECK })
    expect(docRows).toHaveLength(40)
  })

  it('문서의 모든 행이 코드에 같은 다음 상태로 있다', () => {
    const missing = docRows.filter((r) => nextStateOf(r.from, r.event) !== r.to)
    expect(missing, '코드에 없거나 다음 상태가 다른 문서 행').toEqual([])
  })

  it('코드의 모든 항목이 문서에 있다 (표에 없는 전이 추가 금지)', () => {
    const docKeys = new Set(docRows.map((r) => `${r.from}|${r.event}|${r.to}`))
    const extra = flatTransitions.filter((t) => !docKeys.has(`${t.from}|${t.event}|${t.to}`))
    expect(extra, '문서에 없는 코드 항목').toEqual([])
  })

  it('문서의 상태 이름 대응표 14개가 STATES 와 같다', () => {
    const section = markdown.split('## 상태 이름 대응표')[1].split('\n## ')[0]
    const docStates = [...section.matchAll(/^\| `([A-Z_]+)` \|/gm)].map((m) => m[1])
    expect(docStates.sort()).toEqual([...stateValues].sort())
  })
})
