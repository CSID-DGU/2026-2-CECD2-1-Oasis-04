// 특정 시간대에만 다니는 버스로 가는 경로는 그 버스가 다니는 시간에만 보인다 (2026-11-22 방선우).
//
// 카카오 길찾기는 시각을 받지 않아서 낮에도 "N37(심야)" 로 가는 경로를, 주말에도 "8101(출근)" 으로 가는 경로를 준다.
// 경로 서버 응답에는 운행 시간이 없어, 카카오가 버스 이름에 붙이는 표시로 가린다.
//   규칙  다니는 시간대의 10분 전부터 10분 뒤까지만 보인다 (MARGIN_MIN). 요일이 정해진 버스는 그 요일에만
//         한 구간의 버스가 모두 지금 다니지 않으면 그 경로를 뺀다. 다니는 버스가 함께 있으면 안 다니는 버스만 목록에서 뺀다
//
//   표시            다니는 때                         근거
//   (심야)          노선별 첫차 ~ 막차 (아래 표)      서울시 「심야 전용 시내버스(올빼미버스) 운행」 안내, 14개 노선
//                                                    (news.seoul.go.kr/traffic/archives/27974, 2026-03-20 수정)
//   (출근)          평일 06:00 ~ 09:00               노선별 자료가 없어 넓게 잡은 값. 서울 출근맞춤버스는 평일 07~09시로 안내됐다
//   (퇴근)          평일 17:00 ~ 20:00               노선별 자료가 없어 넓게 잡은 값. 서울 8761 은 평일 17:30~19:30 으로 안내됐다
//   (출퇴근)        위의 두 시간대
//   (평일)          월 ~ 금
//   (공휴일제외)    월 ~ 토                           일요일만 가린다. 그 밖의 공휴일은 달력이 없어 가리지 못한다
//   새벽…           평일 03:30 ~ 05:00               새벽동행 자율주행버스(새벽A160 등). 03:30 에 한 번 출발하는 것으로 안내됐다
//
//   (심야) 표의 첫·막차가 어느 정류장 기준인지는 안내에 없다. 종점에서 먼 정류장은 막차가 이보다 늦게 지나간다.
//   표에 없는 심야버스(심야A21 등)는 표에서 가장 이른 첫차 ~ 가장 늦은 막차로 본다.
//   번호가 N 으로 시작해도 "(심야)" 가 없으면 심야버스가 아니다 (고양 마을버스 N002 등).
//   모르는 표시("(임시)" 등)는 가리지 않는다. 노선이나 시간이 바뀌면 이 파일의 표를 고친다.
//   시각과 요일은 한국 시각으로 본다 (브라우저의 시간대와 상관없이).
//
// 표시가 없는 보통 버스는 밤에도 빼지 않는다 (첫·막차 자료가 없다).

export const MARGIN_MIN = 10

/** 심야버스 노선 번호 → [첫차, 막차] (HH:MM, 막차는 다음 날 새벽) */
export const NIGHT_BUS_HOURS = Object.freeze({
  N13: ['23:30', '03:40'],
  N15: ['23:30', '03:30'],
  N16: ['23:50', '03:45'],
  N26: ['00:00', '03:25'],
  N30: ['23:10', '03:50'],
  N31: ['23:30', '03:50'],
  N37: ['00:00', '03:10'],
  N51: ['23:40', '03:45'],
  N61: ['23:40', '04:10'],
  N62: ['23:40', '03:10'],
  N64: ['23:40', '03:15'],
  N72: ['23:30', '03:45'],
  N73: ['23:30', '03:35'],
  N75: ['23:30', '03:50'],
})

/** 표에 없는 심야버스에 쓰는 시간: 표에서 가장 이른 첫차 ~ 가장 늦은 막차 */
export const NIGHT_BUS_DEFAULT_HOURS = Object.freeze(['23:10', '04:10'])

const WEEKDAYS = Object.freeze([1, 2, 3, 4, 5]) // 0 = 일요일
const MORNING = Object.freeze(['06:00', '09:00'])
const EVENING = Object.freeze(['17:00', '20:00'])

/** 괄호 표시 → 다니는 때. days 가 없으면 매일, windows 가 없으면 하루 종일 */
export const TAG_RULES = Object.freeze({
  출근: { days: WEEKDAYS, windows: [MORNING] },
  퇴근: { days: WEEKDAYS, windows: [EVENING] },
  출퇴근: { days: WEEKDAYS, windows: [MORNING, EVENING] },
  평일: { days: WEEKDAYS },
  공휴일제외: { days: [1, 2, 3, 4, 5, 6] },
})

/** 이름이 "새벽" 으로 시작하는 버스 (새벽동행 자율주행버스) */
export const DAWN_RULE = Object.freeze({ days: WEEKDAYS, windows: [['03:30', '05:00']] })

const DAY_MIN = 24 * 60
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))
const wrap = (m) => ((m % DAY_MIN) + DAY_MIN) % DAY_MIN

/** "N37(심야)" → "N37" */
const numberOf = (name) => String(name ?? '').replace(/\s*\(.*?\)/g, '').trim()
/** "8101(출근)" → ["출근"] */
const tagsOf = (name) => [...String(name ?? '').matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim())

/** 한국 시각으로 자정부터 몇 분인가 */
export function kstMinutes(now = new Date()) {
  return wrap(now.getUTCHours() * 60 + now.getUTCMinutes() + 9 * 60)
}

/** 한국 시각의 요일 (0 = 일요일) */
export function kstDay(now = new Date()) {
  return new Date(now.getTime() + KST_OFFSET_MS).getUTCDay()
}

/** 시각 m(분)이 [first, last] 의 margin 분 앞뒤 안에 있는가. 자정을 넘는 시간대도 받는다 */
function inWindow(m, [first, last], margin) {
  const start = wrap(minutesOf(first) - margin)
  const end = wrap(minutesOf(last) + margin)
  return start <= end ? m >= start && m <= end : m >= start || m <= end
}

/** 심야버스인가: 카카오가 "(심야)" 를 붙였거나 표에 있는 번호 */
export function isNightBus(name) {
  return tagsOf(name).includes('심야') || Object.hasOwn(NIGHT_BUS_HOURS, numberOf(name))
}

/** 이 심야버스가 지금 다니는가: 첫차 margin 분 전 ~ 막차 margin 분 뒤 */
export function nightBusRunning(name, now = new Date(), margin = MARGIN_MIN) {
  return inWindow(kstMinutes(now), NIGHT_BUS_HOURS[numberOf(name)] ?? NIGHT_BUS_DEFAULT_HOURS, margin)
}

/** 이 버스에 걸린 규칙들 (요일·시간대). 늘 다니는 버스는 빈 목록 */
function rulesOf(name) {
  const rules = tagsOf(name)
    .map((tag) => TAG_RULES[tag])
    .filter(Boolean)
  if (/^새벽/.test(String(name ?? '').trim())) rules.push(DAWN_RULE)
  return rules
}

/** 특정 시간대·요일에만 다니는 버스인가 */
export function isTimedBus(name) {
  return isNightBus(name) || rulesOf(name).length > 0
}

/**
 * 이 버스가 지금 다니는가. 표시가 없는 버스와 모르는 표시는 늘 다니는 것으로 본다.
 * 표시가 여럿이면 모두 맞아야 한다
 */
export function busRunning(name, now = new Date(), margin = MARGIN_MIN) {
  if (isNightBus(name) && !nightBusRunning(name, now, margin)) return false
  const m = kstMinutes(now)
  const day = kstDay(now)
  return rulesOf(name).every((rule) => (!rule.days || rule.days.includes(day)) && (!rule.windows || rule.windows.some((w) => inWindow(m, w, margin))))
}

/**
 * 경로 서버의 경로 배열(GET /routes/transit)에서 지금 탈 수 없는 버스를 뺀다.
 * 버스 구간의 버스가 모두 빠지면 그 경로를 빼고, 일부만 빠지면 그 구간의 vehicle_names 에서만 뺀다. 받은 배열은 바꾸지 않는다
 */
export function runningRoutes(list, now = new Date()) {
  const out = []
  for (const route of list ?? []) {
    let dropped = false
    const steps = (route.steps ?? []).map((step) => {
      const names = step.vehicle_names ?? []
      if (step.type !== 'BUS' || names.every((n) => busRunning(n, now))) return step
      const left = names.filter((n) => busRunning(n, now))
      if (left.length === 0) dropped = true
      if (step.bus_types_by_name) {
        const display = left.find((name) => !/\(/.test(name)) ?? left[0]
        return { ...step, vehicle_names: left, bus_type: step.bus_types_by_name[display] ?? null }
      }
      return { ...step, vehicle_names: left }
    })
    if (!dropped) out.push({ ...route, steps })
  }
  return out
}
