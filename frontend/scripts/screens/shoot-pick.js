// CONFIRMING·MANUAL_SELECT 의 모든 경우를 앱과 확정 시안에서 같은 시각·크기로 찍는다 (계획서 5단계에서 생김). 사용법은 README.md.
// 그림: shots/mock-step5/<경우>.png(시안), shots/current-step5/<경우>.png(앱), 둘 다 -blur.png 도 찍는다.
// 경우: c3(후보 3개 "병원"), cmd(명동 3개), c1(후보 1개), clong(긴 이름), m(목록), mnovoice('말로 하기' 숨김), mloading, merror, mlong(긴 이름)
// 앱은 실제 mock 흐름으로 간다: DevPanel 마이크 입력("병원"·"명동") → RESOLVING → /resolve mock.
//   후보 1개·긴 이름은 DevPanel '후보 묶음', 목록 오류·긴 이름은 mock 시나리오 poisError·longNames.
// 돌려주는 숫자: shoot-screens.js 와 같은 하한선 + 가장 큰 글씨, 주 버튼 자리, 카드마다 이름 줄 수와 자리(x,y,w,h), 가장 아래 끝.
// MOCK_SHOTS 를 false 로 하면 시안은 찍지 않는다
async (page) => {
  const ROOT = 'C:/Users/ckdal/Capstone_Design2/2026-2-CECD2-1-Oasis-04/.playwright-mcp/shots'
  const APP = 'http://localhost:5173/'
  const MOCK = 'http://127.0.0.1:8800/design/mockups/confirmed/'
  await page.setViewportSize({ width: 1920, height: 1080 })
  const T0 = new Date('2026-11-19T14:30:00').getTime()
  await page.clock.install({ time: T0 })
  await page.clock.pauseAt(T0 + 10)

  const measure = () =>
    page.evaluate(() => {
      const ok = new Set([
        'rgb(17, 17, 17)|rgb(255, 255, 255)', 'rgb(140, 29, 24)|rgb(255, 255, 255)', 'rgb(255, 255, 255)|rgb(10, 74, 159)',
        'rgb(17, 17, 17)|rgb(242, 242, 242)', 'rgb(17, 17, 17)|rgb(234, 242, 252)', 'rgb(255, 255, 255)|rgb(17, 17, 17)',
      ])
      const bg = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)') return c } return 'rgb(255, 255, 255)' }
      const stage = document.querySelector('.stage') || document.querySelector('section.screen')
      const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      let small = 0, minFont = 999, maxFont = 0
      const bad = []
      for (const el of stage.querySelectorAll('*')) {
        if (!hasText(el) || !el.getClientRects().length) continue
        const cs = getComputedStyle(el); const f = parseFloat(cs.fontSize)
        minFont = Math.min(minFont, f); maxFont = Math.max(maxFont, f)
        if (f < 30) small++
        const k = cs.color + '|' + bg(el); if (!ok.has(k)) bad.push(k)
      }
      const btns = [...stage.querySelectorAll('button')]
      const lowBtn = btns.filter((b) => b.getBoundingClientRect().height < 112).length
      const prim = [...stage.querySelectorAll('.btn-primary')]
      const scroll = [...stage.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY !== 'visible').length
      const top = stage.getBoundingClientRect().top
      const rect = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y - top), Math.round(r.width), Math.round(r.height)] }
      const cards = [...stage.querySelectorAll('.pick')].map((c) => {
        const n = c.querySelector('.pick-name'); const lines = Math.round(n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight))
        return `${n.textContent}:${lines}줄 ${rect(c).join(',')}`
      })
      const bottom = Math.max(...[...stage.querySelectorAll('*')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().bottom - top))
      return { minFont, maxFont, small, btns: btns.length, lowBtn, primary: prim.length, primaryRect: prim.map(rect), bad: [...new Set(bad)], scroll, bottom: Math.round(bottom), cards }
    })

  const out = []
  const snap = async (dir, name, sel) => {
    await page.evaluate(() => document.fonts.ready)
    await page.locator(sel).screenshot({ path: `${ROOT}/${dir}/${name}.png` })
    await page.addStyleTag({ content: `${sel} > *{filter:blur(12px)}` })
    await page.locator(sel).screenshot({ path: `${ROOT}/${dir}/${name}-blur.png` })
    await page.evaluate(() => document.head.lastElementChild.remove())
    out.push(`${dir}/${name} ${JSON.stringify(await measure())}`)
  }

  // ---- 시안 ----
  const mocks = {
    'c3': 'confirming-final.html', 'c1': 'confirming-final.html?n=1', 'cmd': 'confirming-final.html?set=myeongdong', 'clong': 'confirming-final.html?names=long',
    'm': 'manual-select-final.html', 'mnovoice': 'manual-select-final.html?voice=0', 'mloading': 'manual-select-final.html?state=loading&freeze=0',
    'merror': 'manual-select-final.html?state=error', 'mlong': 'manual-select-final.html?names=long',
  }
  const MOCK_SHOTS = true
  for (const [name, url] of Object.entries(MOCK_SHOTS ? mocks : {})) {
    await page.goto(MOCK + url); await snap('mock-step5', name, 'section.screen')
  }

  // ---- 앱 ----
  await page.goto(APP)
  await page.waitForSelector('.stage')
  await page.addStyleTag({ content: 'aside[aria-label="개발자 패널"]{display:none !important} .ring-arc{animation:none !important}' })
  const ev = async (n) => {
    const ok = await page.evaluate((n) => { const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.startsWith(n + ' ') || x.textContent.includes('(' + n + ')')); if (!b) return false; b.click(); return true }, n)
    if (!ok) throw new Error('단추 없음 ' + n + ' / ' + (await page.evaluate(() => document.querySelector('aside').textContent.slice(0, 80))))
    await page.waitForTimeout(80)
  }
  const pick = (label, v) => page.evaluate(([l, v]) => {
    const sel = document.querySelector(`aside select[aria-label="${l}"]`)
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, v)
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }, [label, v])
  const say = async (text) => {
    await ev('MIC_BUTTON_PRESSED')
    await page.evaluate((t) => {
      const el = document.querySelector('aside input')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, t)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, text)
    await page.clock.runFor(2700) // 무음 2.5초 → SPEECH_END
  }

  const settle = async () => { for (let i = 0; i < 4; i++) { await page.clock.runFor(500); await page.waitForTimeout(50) } }
  // 말로 하기 숨김: 시작 점검에서 마이크 불가
  await ev('MIC_OR_STT_UNAVAILABLE'); await ev('MANUAL_SELECT_PRESSED'); await page.clock.runFor(1000)
  await snap('current-step5', 'mnovoice', '.stage')
  await ev('DEV_RESET'); await ev('HEALTH_OK')
  // 목록
  await ev('MANUAL_SELECT_PRESSED'); await page.clock.runFor(1000); await snap('current-step5', 'm', '.stage')
  await ev('GO_HOME'); await ev('MANUAL_SELECT_PRESSED'); await snap('current-step5', 'mloading', '.stage')
  await page.clock.runFor(1000); await ev('GO_HOME')
  await pick('mock 시나리오', 'poisError'); await ev('MANUAL_SELECT_PRESSED'); await page.clock.runFor(1000); await snap('current-step5', 'merror', '.stage'); await ev('GO_HOME')
  await pick('mock 시나리오', 'longNames'); await ev('MANUAL_SELECT_PRESSED'); await page.clock.runFor(1000); await snap('current-step5', 'mlong', '.stage'); await ev('GO_HOME')
  await pick('mock 시나리오', 'normal')
  // CONFIRMING: 실제 mock 흐름 (말 → RESOLVING → /resolve mock)
  await say('병원'); await settle(); await snap('current-step5', 'c3', '.stage'); await ev('GO_HOME')
  await say('명동'); await settle(); await snap('current-step5', 'cmd', '.stage'); await ev('GO_HOME')
  // 후보 1개·긴 이름: 들은 말 "병원" 으로 RESOLVING 까지 간 뒤 DevPanel 후보 묶음으로
  for (const [name, set] of [['c1', 'one'], ['clong', 'long']]) {
    await say('병원'); await pick('후보 묶음', set); await ev('RESOLVE_NEED_CONFIRM'); await snap('current-step5', name, '.stage')
    await page.clock.runFor(1000); await ev('GO_HOME')
  }
  return out.join('\n')
}
