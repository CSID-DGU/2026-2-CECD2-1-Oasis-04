// 화면이 소리로 읽어 줄 문장을 만든다 (순수 함수. 테스트: __tests__/speechText.test.js).
// 화면에 글로 보이는 것은 그 글과 같은 말로 읽고, 그림으로만 보이는 것(경로 타임라인)은 문장으로 푼다.
// 여기서는 문장만 만든다. 언제 읽을지는 화면의 useSay, 읽는 일은 devices/speaker.js 가 맡는다.
//
// 읽는 화면과 문장
//   CONFIRMING     후보 1개: "○○, 맞나요?" + 누를 버튼 / 여러 개: 질문 + 후보 이름
//   REASKING       "잘 못 알아들었어요." + 누를 버튼
//   MANUAL_SELECT  화면 제목
//   UNAVAILABLE    안내할 수 없는 이유 (화면의 문구 그대로)
//   ROUTE_GUIDE    고른 경로: 걸리는 시간·갈아타는 횟수 → 구간마다 한 문장 → 나갈 출구
//   QR_HANDOFF     단계 세 줄 (화면의 문구 그대로)
// 버튼을 눌러야 넘어가는 화면(CONFIRMING, REASKING)은 무엇을 누를지도 말한다. 이 화면들은 자동으로 듣지 않기 때문이다.

const DIGITS = ['공', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const NATIVE_ONES = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉']
const NATIVE_TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔']

/** 세는 말: 1 → 한, 2 → 두, 12 → 열두, 20 → 스무. "몇 번째", "몇 번 갈아타요" 처럼 세는 자리에만 쓴다. 1~99 밖이면 숫자 그대로 */
export function countWord(n) {
  if (!Number.isInteger(n) || n < 1 || n > 99) return String(n)
  if (n === 20) return '스무'
  return NATIVE_TENS[Math.floor(n / 10)] + NATIVE_ONES[n % 10]
}

// 숫자로 끝나는 말의 받침: 0(공)·3(삼)·6(육) 은 받침, 1(일)·7(칠)·8(팔) 은 ㄹ 받침, 나머지는 받침 없음
const DIGIT_END = ['other', 'rieul', 'none', 'other', 'none', 'none', 'other', 'rieul', 'rieul', 'none']

function endSound(word) {
  const ch = String(word ?? '').trim().slice(-1)
  if (/\d/.test(ch)) return DIGIT_END[Number(ch)]
  const code = ch.charCodeAt(0)
  if (!(code >= 0xac00 && code <= 0xd7a3)) return 'none' // 한글이 아니면 받침 없는 것으로 본다
  const jong = (code - 0xac00) % 28
  return jong === 0 ? 'none' : jong === 8 ? 'rieul' : 'other'
}

/** 조사를 붙인다. pair 는 '을/를' 또는 '으로/로' */
export function withJosa(word, pair) {
  const end = endSound(word)
  if (pair === '으로/로') return `${word}${end === 'other' ? '으로' : '로'}`
  return `${word}${end === 'none' ? '를' : '을'}`
}

/**
 * 버스 번호를 읽기 좋게: 네 자리 이상이거나 0 으로 시작하면 한 자리씩 읽는다.
 * "7212" → "칠이일이", "종로01" → "종로공일", "6002-1" → "육공공이 다시 1".
 * 세 자리 이하("273")는 그대로 두고, 넘기기 직전에 spoken 이 한자어로 바꾼다 ("이백칠십삼")
 */
export function busSpoken(number) {
  return String(number ?? '')
    .replace(/(\d)-(?=\d)/g, '$1 다시 ')
    .replace(/\d+/g, (run) => (run.length >= 4 || run.startsWith('0') ? [...run].map((d) => DIGITS[Number(d)]).join('') : run))
}

const SINO = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const SINO_UNITS = ['', '십', '백', '천']

/** 0~9999 를 한자어로. 십·백·천 앞의 1 은 읽지 않는다 (110 → 백십) */
function sinoBelowTenThousand(v) {
  const s = String(v)
  return [...s].map((d, i) => (d === '0' ? '' : `${d === '1' && i < s.length - 1 ? '' : SINO[Number(d)]}${SINO_UNITS[s.length - 1 - i]}`)).join('')
}

/** 한자어로 읽은 수: 6 → 육, 12 → 십이, 273 → 이백칠십삼, 1100 → 천백, 12000 → 만이천 */
export function sinoNumber(n) {
  if (!Number.isInteger(n) || n < 0) return String(n)
  if (n === 0) return SINO[0]
  const man = Math.floor(n / 10000)
  const rest = n % 10000
  return `${man ? `${man === 1 ? '' : sinoBelowTenThousand(man)}만` : ''}${rest ? sinoBelowTenThousand(rest) : ''}`
}

const digitsSpoken = (run) => [...run].map((d) => DIGITS[Number(d)]).join('')

/**
 * 목소리에 넘기기 전에 글을 다듬는다. 뜻은 바꾸지 않는다.
 *   따옴표를 뺀다. 이름 가운데 점은 쉼표로 ("종로3가.탑골공원" → "종로 삼가, 탑골공원"). 괄호도 쉼표로. "QR" 은 "큐알"
 *   숫자는 글자로 바꿔 넘긴다. 목소리가 "6번 출구" 를 "여섯 번 출구" 로 읽기 때문이다 (2026-11-22)
 *     숫자로 적힌 것은 한자어로: "6번" → "육번", "3호선" → "삼호선", "14분" → "십사분", "1.5" → "일 점 오"
 *     "N번째" 만 우리말로: "2번째" → "두 번째", "1번째" → "첫 번째"
 *     0 으로 시작하거나 아주 긴 숫자는 한 자리씩. 이름에 붙은 숫자는 띄운다 ("안국역6번출구" → "안국역 육번출구")
 */
export function spoken(text) {
  return String(text ?? '')
    .replace(/[“”‘’"']/g, '')
    .replace(/QR/g, '큐알')
    .replace(/\s*\(\s*/g, ', ')
    .replace(/\s*\)/g, '')
    .replace(/([가-힣0-9A-Za-z])[.·](?=[가-힣A-Za-z])/g, '$1, ')
    .replace(/([가-힣])(?=\d)/g, '$1 ')
    .replace(/(\d+)\s*번째/g, (_, d) => `${Number(d) === 1 ? '첫' : countWord(Number(d))} 번째`)
    .replace(/(\d+)\.(\d+)/g, (_, a, b) => `${sinoNumber(Number(a))} 점 ${digitsSpoken(b)}`)
    .replace(/\d+/g, (run) => ((run.length > 1 && run.startsWith('0')) || run.length > 8 ? digitsSpoken(run) : sinoNumber(Number(run))))
    .replace(/(,\s*)+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()
}

const isRide = (leg) => leg.mode === 'SUBWAY' || leg.mode === 'BUS'

/** 장소 이름. 정류장은 이름 끝에 "정류장" 이 없으면 붙인다 (역은 이름에 이미 "역" 이 있다) */
function placeSpoken(place) {
  const name = String(place?.name ?? '').trim()
  if (!name) return ''
  return place.kind === 'STOP' && !/정류장$/.test(name) ? `${name} 정류장` : name
}

/** 표지 글자 → 노선 이름: "3" → "3호선", "공항철도" → 그대로 */
const lineSpoken = (label) => (/^\d+$/.test(String(label)) ? `${label}호선` : String(label ?? ''))

/** 걸리는 시간과 갈아타는 횟수. 가실 곳 이름은 이용자가 고른 목적지, 없으면 경로의 마지막 장소 */
function summaryLines(route, destination) {
  const dest = String(destination ?? '').trim() || placeSpoken(route.dest)
  const lines = []
  if (Number.isFinite(route.durationMin)) lines.push(`${dest ? `${dest}까지 ` : ''}${route.durationMin}분쯤 걸려요.`)
  else if (dest) lines.push(`${dest}까지 가는 길이에요.`)
  if (!route.walkOnly) lines.push(route.transfers > 0 ? `${countWord(route.transfers)} 번 갈아타요.` : '갈아타지 않아요.')
  return lines
}

/**
 * 경로 하나(view/routeView.js 의 toRouteView 결과) → 읽을 문장 목록.
 * 타임라인은 길면 가운데를 접지만 소리로는 끝까지 읽는다.
 *   "서울대학교병원까지 14분쯤 걸려요." "갈아타지 않아요."
 *   "종로3가역에서 4호선을 타고, 두 번째 역인 혜화역에서 내리세요." "3번 출구로 나가세요."
 *   "서울대학교병원까지 걸어서 7분 가세요."
 * destination: 이용자가 고른 목적지 이름. 서버 경로가 마지막에 내리는 정류장에서 끝나도("창덕궁") 첫 문장은 고른 곳("안국역까지")으로 말한다
 */
export function routeSpeech(route, { destination = '' } = {}) {
  if (!route) return []
  const legs = route.legs ?? []
  const lines = summaryLines(route, destination)
  const lastRide = legs.map(isRide).lastIndexOf(true)
  let here = placeSpoken(route.start)
  let rides = 0
  legs.forEach((leg, i) => {
    if (!isRide(leg)) {
      const to = placeSpoken(leg.to)
      const walk = Number.isFinite(leg.minutes) ? `걸어서 ${leg.minutes}분` : '걸어서'
      if (to) lines.push(`${to}까지 ${walk} 가세요.`)
      else if (lastRide >= 0 && i > lastRide) lines.push(`내려서 ${walk} 가세요.`)
      else if (rides > 0) lines.push(`${walk} 가서 갈아타세요.`)
      else lines.push(`${walk} 가세요.`)
      if (to) here = to
      return
    }
    const bus = leg.mode === 'BUS'
    const vehicle = bus ? `${busSpoken(leg.text)}번 버스` : lineSpoken(leg.text)
    const ride = rides === 0 ? `${withJosa(vehicle, '을/를')} 타고` : `${withJosa(vehicle, '으로/로')} 갈아타고`
    const unit = bus ? '정류장' : '역'
    const count = leg.stops === 1 ? `다음 ${unit}인 ` : Number.isInteger(leg.stops) && leg.stops > 1 ? `${countWord(leg.stops)} 번째 ${unit}인 ` : ''
    // "다섯 번째 정류장인 ○○ 정류장" 처럼 겹치지 않게, 몇 번째인지 말할 때는 정류장 이름만 읽는다
    const to = bus && count ? String(leg.to?.name ?? '').trim() : placeSpoken(leg.to)
    const from = here ? `${here}에서 ` : ''
    lines.push(to ? `${from}${ride}, ${count}${to}에서 내리세요.` : `${from}${ride} 가세요.`)
    if (leg.to?.name) here = placeSpoken(leg.to)
    rides += 1
    if (i === lastRide && route.exit) lines.push(`${route.exit}번 출구로 나가세요.`)
  })
  return lines
}

export const CONFIRM_DEFAULT_QUESTION = '가시려는 곳을 하나 골라 주세요'

/** CONFIRMING: 후보 목록과 서버의 질문(없으면 화면의 기본 문구) → 읽을 문장 */
export function confirmSpeech({ candidates = [], question = '' } = {}) {
  const names = candidates.map((c) => c?.name).filter(Boolean)
  if (names.length === 0) return ['후보 목적지를 찾지 못했어요.']
  if (names.length === 1) return [`${names[0]}, 맞나요?`, '맞으면 예를 눌러 주세요.']
  const list = `${names.join(', ')}.`
  if (!question) return [`${CONFIRM_DEFAULT_QUESTION}.`, list]
  // 서버의 질문에 후보 이름이 모두 들어 있으면 이름을 한 번 더 읽지 않는다
  const said = names.every((n) => question.includes(n))
  return [question, said ? null : list, '화면에서 골라 주세요.'].filter(Boolean)
}

/** REASKING */
export function reaskSpeech() {
  return ['잘 못 알아들었어요.', '다시 말하기를 누르고 한 번 더 말씀해 주세요.']
}

/** UNAVAILABLE: 화면에 보이는 이유 문구 그대로 */
export function unavailableSpeech(text) {
  return text ? [text] : []
}

/** QR_HANDOFF: QR 이 만들어지면 단계 문구를, 실패하면 그 문구를 읽는다. 만드는 중에는 읽지 않는다 */
export function qrSpeech(status, { steps = [], message = '' } = {}) {
  if (status === 'ready') return steps.map((s) => `${s}.`)
  if (status === 'error') return message ? [`${message}.`] : []
  return []
}
