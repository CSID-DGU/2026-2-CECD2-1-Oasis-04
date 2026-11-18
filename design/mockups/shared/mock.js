// 시안 페이지 공통. 주소 끝에 ?s=IDLE 처럼 화면 이름을 붙이면 그 화면만 남긴다 (스크린샷용).
// 아무것도 안 붙이면 6개 화면이 세로로 이어져 보인다.
const params = new URLSearchParams(location.search)
const wanted = params.get('s')
if (wanted) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.hidden = el.dataset.screen !== wanted
  })
}

// 주소에 &measure=1 을 더하면 하한선 점검 값을 화면 대신 글자로 내놓는다 (README '하한선 검사').
//   글씨: 30px 미만인 것 / 버튼: 112px 미만인 것 / 색: 디자인 문서 3-2절 '허용 조합' 표에 없는 글씨·배경 쌍
//   그 밖에 화면 밖으로 나간 요소 수, 스크롤 여부, 핵심 줄과 첫 버튼 사이 거리
if (wanted && params.has('measure')) {
  // 문서 3-2절 표를 그대로 옮긴 것. 표가 바뀌면 여기도 고친다
  const LIGHT_BG = ['#ffffff', '#f2f2f2', '#eaf2fc', '#e6e6e6']
  const ALLOWED = new Set([
    ...['#111111', '#444444', '#8c1d18', '#0a4a9f'].flatMap((text) => LIGHT_BG.map((bg) => `${text} on ${bg}`)),
    '#ffffff on #0a4a9f',
    '#ffffff on #083a7d',
    '#ffffff on #111111', // 머리말 띠
  ])
  ALLOWED.delete('#0a4a9f on #e6e6e6') // 6.75:1 미달로 금지된 조합
  // 시안이 새로 제안하는 조합: <meta name="proposed-pairs" content="#ffffff on #0f5132, ...">. 표에는 없으므로 따로 센다
  const PROPOSED = new Set((document.querySelector('meta[name="proposed-pairs"]')?.content ?? '').split(',').map((p) => p.trim()).filter(Boolean))

  const toHex = (rgb) => {
    const [r, g, b, a = 1] = rgb.match(/[\d.]+/g).map(Number)
    return a === 0 ? null : '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
  }
  // 글씨 뒤에 실제로 깔린 배경: 투명하지 않은 배경이 나올 때까지 부모로 올라간다
  const backgroundOf = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const hex = toHex(getComputedStyle(node).backgroundColor)
      if (hex) return hex
    }
    return '#ffffff'
  }
  const label = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.split(' ').join('.') : ''} "${el.textContent.trim().slice(0, 12)}"`

  // 글꼴을 읽고, 화면이 스스로 크기를 맞추는 일(v8-band.js 의 fitName 등)이 끝난 뒤에 잰다
  document.fonts.ready.then(() => new Promise((done) => setTimeout(done, 200))).then(() => {
    const screen = document.querySelector('.screen:not([hidden])')
    const box = screen.getBoundingClientRect()
    const all = [...screen.querySelectorAll('*')]
    const buttons = [...screen.querySelectorAll('.btn')]
    const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    const texts = all.filter(hasOwnText).filter((el) => !el.closest('[aria-hidden]'))
    const pairs = texts.map((el) => ({ el, pair: `${toHex(getComputedStyle(el).color)} on ${backgroundOf(el)}` }))
    const outside = all.filter((el) => {
      if (el.closest('svg') && el.tagName !== 'svg') return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && (r.left < box.left || r.right > box.right || r.top < box.top || r.bottom > box.bottom)
    })
    // 핵심 줄: 방향별 핵심 표시가 있으면 그것, 없으면 화면 제목(제목이 곧 핵심인 화면)
    const core = screen.querySelector('.a-core, .b-core, .c-core, .v2-core, .v3-core') ?? screen.querySelector('.screen-title, .c-title, .a-label, .v2-title')
    const heightOf = (el) => Math.round(el.getBoundingClientRect().height)
    const sizeOf = (el) => parseFloat(getComputedStyle(el).fontSize)
    const result = {
      screen: wanted,
      texts: texts.length,
      minFontSize: Math.min(...texts.map(sizeOf)),
      smallText: texts.filter((el) => sizeOf(el) < 30).map(label),
      buttons: buttons.length,
      minButtonHeight: buttons.length ? Math.min(...buttons.map(heightOf)) : null,
      lowButtons: buttons.filter((el) => heightOf(el) < 112).map(label),
      colorPairs: [...new Set(pairs.map((p) => p.pair))].sort(),
      badColors: pairs.filter((p) => !ALLOWED.has(p.pair) && !PROPOSED.has(p.pair)).map((p) => `${p.pair}: ${label(p.el)}`),
      proposedColors: [...new Set(pairs.filter((p) => PROPOSED.has(p.pair)).map((p) => p.pair))],
      outside: outside.length,
      scrolls: screen.scrollHeight > screen.clientHeight,
      coreToFirstButton: buttons.length && core ? Math.round(buttons[0].getBoundingClientRect().top - core.getBoundingClientRect().bottom) : null,
      lastButtonBottom: buttons.length ? Math.round(buttons.at(-1).getBoundingClientRect().bottom - box.top) : null,
      // 시선 순서 확인용 숫자 (문서 3-9절): 주 버튼이 화면 넓이에서 차지하는 비율, 가장 큰 글씨, 주 버튼 글씨
      ...(() => {
        const primary = screen.querySelector('.btn-primary')
        if (!primary) return { primaryAreaPct: null, primaryFontSize: null }
        const r = primary.getBoundingClientRect()
        const primaryTexts = texts.filter((el) => primary.contains(el))
        return {
          primarySize: `${Math.round(r.width)}×${Math.round(r.height)}`,
          primaryAreaPct: Math.round(((r.width * r.height) / (box.width * box.height)) * 1000) / 10,
          primaryFontSize: Math.max(...primaryTexts.map(sizeOf)),
        }
      })(),
      // 글씨 크기마다 몇 군데에 쓰였는지와 보기 하나 (작은 글씨가 어디에 있는지 보려고)
      fontSizes: Object.fromEntries(
        [...new Set(texts.map(sizeOf))].sort((a, b) => a - b).map((size) => {
          const same = texts.filter((el) => sizeOf(el) === size)
          return [size, `${same.length}곳, 예: ${same[0].textContent.trim().slice(0, 10)}`]
        }),
      ),
      // 배경색: 화면 넓이의 1% 이상을 덮는, 버튼이 아닌 요소의 배경색
      backgrounds: [
        ...new Set(
          [screen, ...all]
            .filter((el) => !el.closest('.btn'))
            .filter((el) => {
              const r = el.getBoundingClientRect()
              return toHex(getComputedStyle(el).backgroundColor) && r.width * r.height >= box.width * box.height * 0.01
            })
            .map((el) => toHex(getComputedStyle(el).backgroundColor)),
        ),
      ],
      // 구역의 자리 [왼쪽, 위, 너비, 높이]: data-zone 을 붙인 요소 (빈 영역 크기를 계산할 때 쓴다)
      zones: Object.fromEntries(
        [...screen.querySelectorAll('[data-zone]')].map((el) => {
          const r = el.getBoundingClientRect()
          return [el.dataset.zone, [r.left - box.left, r.top - box.top, r.width, r.height].map(Math.round)]
        }),
      ),
      // 역명판 이름 규칙의 결과 (v8-name.js 의 fitPlaceName 이 띠에 남긴 값)
      placeName: JSON.parse(screen.querySelector('[data-place-name]')?.dataset.placeName ?? 'null'),
      maxFontSize: Math.max(...texts.map(sizeOf)),
      maxFontText: label(texts.reduce((a, b) => (sizeOf(b) > sizeOf(a) ? b : a))),
    }
    document.body.innerHTML = `<pre id="measure">${JSON.stringify(result)}</pre>`
  })
}
