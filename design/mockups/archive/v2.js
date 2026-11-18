// v2 시안 전용: 머리말 띠의 시각, 고리 그림과 음량 표시, 시연 페이지(누르면 다음 화면).
// 화면 하나만 보이기(?s=)와 하한선 검사(&measure=1)는 mock.js 가 맡는다.

const query = new URLSearchParams(location.search)
const still = matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------- 머리말 띠: 현재 시각 ("오후 2:30") ----------
function clockText(now = new Date()) {
  const h = now.getHours()
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${m}`
}
function tickClock() {
  document.querySelectorAll('.v2-clock').forEach((el) => (el.textContent = clockText()))
}
tickClock()
setInterval(tickClock, 10_000)

// ---------- 고리: 역 고리 + 마이크 + 둘레 막대 ----------
// 520×520 안에 그린다. 막대 길이 0 이면 점으로 보인다(IDLE 의 쉬는 모습).
const BARS = 56
const CENTER = 260
const BAR_FROM = 172 // 막대가 시작하는 반지름
const BAR_MAX = 80 // 가장 긴 막대

function drawMeter(el) {
  const live = el.dataset.mode === 'live'
  const bars = Array.from({ length: BARS }, (_, i) => {
    const a = (i / BARS) * Math.PI * 2
    const x = (CENTER + Math.sin(a) * BAR_FROM).toFixed(1)
    const y = (CENTER - Math.cos(a) * BAR_FROM).toFixed(1)
    return `<line x1="${x}" y1="${y}" x2="${x}" y2="${y}" />`
  }).join('')
  el.innerHTML = `
    <svg viewBox="0 0 520 520" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <g stroke-width="10">${bars}</g>
      <circle cx="260" cy="260" r="127" stroke-width="26" />
      <g transform="translate(170 166) scale(0.9)" stroke-width="13">
        <rect x="75" y="30" width="50" height="90" rx="25" ${live ? 'fill="currentColor"' : ''} />
        <path d="M50 95a50 50 0 0 0 100 0M100 145v25M70 170h60" />
      </g>
    </svg>`
  return [...el.querySelectorAll('g:first-of-type line')]
}

// 가짜 음량 (0~1). 말소리처럼: 음절마다 오르내리고, 가끔 숨을 쉬듯 잦아든다.
// 실제 앱에서는 녹음 부품이 마이크 음량을 알려 줘야 한다 (지금은 없는 기능).
function fakeLevel(t) {
  const syllables = 0.5 + 0.5 * Math.sin(t * 7.3) * Math.sin(t * 2.9 + 1.3)
  const phrase = Math.sin(t * 0.9) > -0.55 ? 1 : 0.12
  return Math.min(1, Math.max(0.06, (0.25 + 0.75 * syllables) * phrase))
}

function setBars(lines, lengthOf) {
  lines.forEach((line, i) => {
    const a = (i / BARS) * Math.PI * 2
    const r = BAR_FROM + lengthOf(i)
    line.setAttribute('x2', (CENTER + Math.sin(a) * r).toFixed(1))
    line.setAttribute('y2', (CENTER - Math.cos(a) * r).toFixed(1))
  })
}

document.querySelectorAll('.v2-meter').forEach((el) => {
  const lines = drawMeter(el)
  if (el.dataset.mode !== 'live') return
  // 막대마다 조금씩 다른 높이: 고리를 한 바퀴 도는 물결 두 개를 겹친다
  const shape = (i, t) => 0.55 + 0.45 * Math.sin(i * 0.9 + t * 3.1) * Math.cos(i * 0.37 - t * 1.7)
  if (still) {
    setBars(lines, (i) => BAR_MAX * 0.45 * shape(i, 0)) // 움직임 줄이기: 멈춘 모습
    return
  }
  let level = 0
  const frame = (ms) => {
    const t = ms / 1000
    level += (fakeLevel(t) - level) * 0.18 // 갑자기 튀지 않게 따라간다
    setBars(lines, (i) => BAR_MAX * level * shape(i, t))
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
})

// ---------- 시연 페이지: 화면을 누르면 실제 흐름 순서대로 다음 화면 ----------
if (query.has('demo')) {
  const ORDER = ['IDLE', 'LISTENING', 'ROUTING', 'ROUTE_GUIDE']
  const screens = ORDER.map((name) => document.querySelector(`.screen[data-screen="${name}"]`))

  const stage = document.createElement('div')
  stage.className = 'v2-stage'
  document.body.prepend(stage)
  screens.forEach((el) => stage.append(el))
  document.body.classList.add('is-demo')

  const note = document.createElement('div')
  note.className = 'v2-demo-note'
  document.body.append(note)

  const fit = () => stage.style.setProperty('--fit', Math.min(innerWidth / 1080, innerHeight / 1920))
  fit()
  addEventListener('resize', fit)

  let index = 0
  const show = () => {
    screens.forEach((el, i) => {
      el.hidden = i !== index
      el.classList.remove('v2-enter')
    })
    void stage.offsetWidth // 같은 움직임을 다시 시작하게 한다
    screens[index].classList.add('v2-enter')
    note.textContent = `${index + 1}/${ORDER.length} ${ORDER[index]} · 화면을 누르면 다음으로`
  }
  show()
  document.addEventListener('click', () => {
    index = (index + 1) % ORDER.length
    show()
  })
}
