// ROUTE_GUIDE 의 모든 경우를 앱과 확정 시안(route-guide-final.html)에서 같은 시각·크기로 찍는다 (계획서 9단계에서 생김). 사용법은 README.md.
// 그림: shots/mock-step9/<경우>.png(시안), shots/current-step9/<경우>.png(앱). blur 에 넣은 경우는 -blur.png 도.
// 경우: subway(?set=subway), bus(기본), long(?set=long), pick2·pick3(?set=subway&pick=), case-<이름>(?case=, route-cases.js 10가지),
//       real-v1·real-transit(앱만. real 서버 응답 두 모양을 실제 변환 코드로 바꾼 예시, api/mock/data/realRouteSamples.js)
// 앱은 DevPanel 로 간다: '장소' 를 고르고(띠 이름) → 손으로 고르기 → POI_SELECTED → '경로 묶음' 을 고르고 ROUTE_FOUND.
//   카드 고르기(pick2·pick3)는 그 카드를 실제로 누른다 (나타나기 250ms 가 끝난 뒤 찍는다).
// 시안의 왼쪽 칸 맨 아래 예시 안내 줄(.guide-note, "버스 번호, 시간, 출구는 예시예요")은 시안 전용이라(디자인 문서 9-1절)
//   앱에 없다. 그 줄이 타임라인 높이를 줄이므로 noteHidden 이 true 면 시안을 그 줄 없이 열어 찍고(주소 응답을 고쳐서),
//   원래 시안의 줄이기 결과(body.dataset.fit)도 따로 읽어 돌려준다.
// 돌려주는 숫자: 하한선(shoot-pick.js 와 같음), 줄이기 단계(steps), 타임라인 넘침, 카드마다 노선 줄 수, 가장 아래 끝
async (page) => {
  const OPTIONS = {
    root: 'C:/Users/ckdal/Capstone_Design2/2026-2-CECD2-1-Oasis-04/.playwright-mcp/shots',
    app: 'http://localhost:5180/?inactivityMs=60000',
    mock: 'http://127.0.0.1:8800/design/mockups/confirmed/route-guide-final.html',
    blur: ['subway', 'pick2', 'long', 'bus', 'case-one'],
    noteHidden: true,
    mockShots: true,
  }
  const CASES = ['transfer3', 'one', 'two', 'walk', 'longcard', 'longname', 'named', 'place', 'noexit', 'longthree']
  // 경우 → [시안 주소 뒤, 앱 장소, 앱 경로 묶음, 누를 카드(1부터, 없으면 0)]
  const ALL = {
    subway: ['?set=subway', 'subway', 'subway', 0],
    bus: ['', 'bus', 'bus', 0],
    long: ['?set=long', 'bus', 'long', 0],
    pick2: ['?set=subway&pick=2', 'subway', 'subway', 2],
    pick3: ['?set=subway&pick=3', 'subway', 'subway', 3],
    ...Object.fromEntries(CASES.map((c) => [`case-${c}`, [`?case=${c}`, 'subway', c, 0]])),
    'real-v1': [null, 'subway', 'real-v1', 0],
    'real-transit': [null, 'subway', 'real-transit', 0],
  }

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
      const tl = stage.querySelector('.timeline')
      const steps = tl?.dataset.fit ? JSON.parse(tl.dataset.fit).steps : JSON.parse(document.body.dataset.fit || '{}').steps
      const cards = [...stage.querySelectorAll('.route-card, .card')].map((c) => {
        const marks = [...c.querySelectorAll('.route-lines-step, .route-lines-walk, .line-step, .walk-mark')]
        return `${new Set(marks.map((m) => Math.round(m.getBoundingClientRect().top))).size}줄 ${rect(c).join(',')}`
      })
      const overflow = tl ? tl.scrollHeight - tl.clientHeight : null
      const bottom = Math.max(...[...stage.querySelectorAll('*')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().bottom - top))
      return { minFont, maxFont, small, btns: btns.length, lowBtn, primary: prim.length, primaryRect: prim.map(rect), bad: [...new Set(bad)], scroll, steps, overflow, cards, bottom: Math.round(bottom) }
    })

  const out = []
  const snap = async (dir, name, sel, extra = {}) => {
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(150)
    await page.locator(sel).screenshot({ path: `${OPTIONS.root}/${dir}/${name}.png` })
    if (OPTIONS.blur.includes(name)) {
      await page.addStyleTag({ content: `${sel} > *{filter:blur(12px)}` })
      await page.locator(sel).screenshot({ path: `${OPTIONS.root}/${dir}/${name}-blur.png` })
      await page.evaluate(() => document.head.lastElementChild.remove())
    }
    out.push(`${dir}/${name} ${JSON.stringify({ ...(await measure()), ...extra })}`)
  }

  // ---- 시안 ----
  if (OPTIONS.mockShots) {
    for (const [name, [query]] of Object.entries(ALL)) {
      if (query === null) continue
      // 원래 시안의 줄이기 결과
      await page.unroute('**/route-guide-final.html*').catch(() => {})
      await page.goto(OPTIONS.mock + query)
      await page.evaluate(() => document.fonts.ready)
      await page.waitForFunction(() => document.body.dataset.fit)
      const original = JSON.parse(await page.evaluate(() => document.body.dataset.fit))
      if (OPTIONS.noteHidden) {
        await page.route('**/route-guide-final.html*', async (route) => {
          const res = await route.fetch()
          const html = (await res.text()).replace('</head>', '<style>.screen .guide-note{display:none !important}</style></head>')
          await route.fulfill({ response: res, body: html })
        })
        await page.goto(OPTIONS.mock + query)
        await page.evaluate(() => document.fonts.ready)
        await page.waitForFunction(() => document.body.dataset.fit)
      }
      await snap('mock-step9', name, 'section.screen', { originalSteps: original.steps, originalOverflow: original.timelineOverflow, originalCards: original.cards })
    }
    await page.unroute('**/route-guide-final.html*').catch(() => {})
  }

  // ---- 앱 ----
  await page.goto(OPTIONS.app)
  await page.waitForSelector('.stage')
  await page.addStyleTag({ content: 'aside[aria-label="개발자 패널"]{display:none !important}' })
  const ev = async (n) => {
    const ok = await page.evaluate((n) => { const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.startsWith(n + ' ')); if (!b) return false; b.click(); return true }, n)
    if (!ok) throw new Error('단추 없음 ' + n)
    await page.waitForTimeout(80)
  }
  const pick = (label, v) => page.evaluate(([l, v]) => {
    const sel = document.querySelector(`aside select[aria-label="${l}"]`)
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, v)
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }, [label, v])

  await ev('HEALTH_OK')
  for (const [name, [, place, set, card]] of Object.entries(ALL)) {
    await pick('mock 장소', place)
    await page.clock.runFor(1000)
    await page.waitForTimeout(50)
    await ev('MANUAL_SELECT_PRESSED')
    await ev('POI_SELECTED')
    await pick('경로 묶음', set)
    await ev('ROUTE_FOUND')
    if (card) {
      await page.locator('.route-card').nth(card - 1).click()
      await page.waitForTimeout(400) // 나타나기 250ms (CSS 움직임은 가짜 시계와 상관없이 흐른다)
    }
    await snap('current-step9', name, '.stage')
    await ev('GO_HOME')
  }
  return out.join('\n')
}
