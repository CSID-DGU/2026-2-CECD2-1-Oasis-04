// v3 시안(IDLE 세 가지 스타일) 공통: 현재 시각·날짜, 차례로 바뀌는 예시 문구.
// 화면 하나만 보이기(?s=)와 하한선 검사(&measure=1)는 mock.js 가 맡는다.

const DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

function tick() {
  const now = new Date()
  const h = now.getHours()
  const time = `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(now.getMinutes()).padStart(2, '0')}`
  const date = `${now.getMonth() + 1}월 ${now.getDate()}일 ${DAYS[now.getDay()]}`
  document.querySelectorAll('[data-clock]').forEach((el) => (el.textContent = time))
  document.querySelectorAll('[data-date]').forEach((el) => (el.textContent = date))
}
tick()
setInterval(tick, 10_000)

// 예시 문구: data-rotate="문구1|문구2|..." 를 4초마다 다음 것으로 바꾼다.
// 바뀔 때 0.25초 동안 흐려졌다 나타난다 (깜빡임 한도 1초 3번보다 훨씬 느리다).
// 움직임 줄이기 설정에서는 첫 문구에서 멈춘다.
const SHOW_MS = 4000
const FADE_MS = 250
const still = matchMedia('(prefers-reduced-motion: reduce)').matches

document.querySelectorAll('[data-rotate]').forEach((el) => {
  const words = el.dataset.rotate.split('|')
  let index = 0
  el.textContent = `“${words[0]}”`
  el.style.transition = `opacity ${FADE_MS}ms`
  if (still || words.length < 2) return
  setInterval(() => {
    el.style.opacity = 0
    setTimeout(() => {
      index = (index + 1) % words.length
      el.textContent = `“${words[index]}”`
      el.style.opacity = 1
    }, FADE_MS)
  }, SHOW_MS)
})
