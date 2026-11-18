// 남은 시간 알림 (확정 2026-11-18, 문서 11-2절). 무입력 화면 6개(CONFIRMING, REASKING, UNAVAILABLE, MANUAL_SELECT, ROUTE_GUIDE, QR_HANDOFF)가
// 같은 얇은 띠를 쓰므로, 띠에 .thin-alert 를 넣고 이 파일을 불러오면 어느 화면에서나 같은 자리에 나온다.
// 주소에 ?left=15 처럼 남은 초를 주면 15 이하일 때 띠 오른쪽의 날짜·시각 자리에 알림이 보인다.
// &live=1 을 더하면 1초에 한 번 줄어든다 (0 이 되면 실제 앱에서는 INACTIVITY_TIMEOUT 으로 IDLE 로 간다. 시안은 0 에서 멈춘다).
// 숫자가 1초에 한 번 바뀌는 것 말고는 움직임이 없다 (깜빡임 한도 안. 문서 3-5절)
//
// 띠 이름 시험: ?place=종로3가.탑골공원 처럼 주면 띠 가운데 이름을 바꾼다 (7절 규칙 2처럼 끝의 "역"·"정류장"은 떼고 준다).
// &gap=1 을 더하면 띠 이름의 오른쪽 끝과 알림 판 왼쪽 끝 사이 거리(px)를 <title> 에 적는다 (음수면 겹침)
;(() => {
  const SHOW_AT = 15 // 이 초 이하일 때만 보인다
  const query = new URLSearchParams(location.search)
  if (query.get('place')) document.querySelectorAll('.thin-place').forEach((el) => (el.textContent = query.get('place')))
  if (query.get('gap') === '1') {
    document.fonts.ready.then(() => {
      const name = document.querySelector('.thin-place').getBoundingClientRect()
      const alert = document.querySelector('.thin-alert').getBoundingClientRect()
      const band = document.querySelector('.thin').getBoundingClientRect()
      document.title = JSON.stringify({ name: Math.round(name.width), alertLeft: Math.round(alert.left), alertRight: Math.round(alert.right), gap: Math.round(alert.left - name.right), bandRight: Math.round(band.right) })
    })
  }
  if (!query.has('left')) return
  let left = Number(query.get('left'))
  const render = () => {
    document.querySelectorAll('.thin').forEach((band) => band.classList.toggle('is-timeout', left <= SHOW_AT))
    document.querySelectorAll('[data-left]').forEach((el) => (el.textContent = left))
  }
  render()
  if (query.get('live') === '1') {
    const timer = setInterval(() => {
      left = Math.max(0, left - 1)
      render()
      if (left === 0) clearInterval(timer)
    }, 1000)
  }
})()
