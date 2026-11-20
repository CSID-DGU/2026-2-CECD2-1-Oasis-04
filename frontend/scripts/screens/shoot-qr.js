// QR_HANDOFF 를 앱과 확정 시안(qr-handoff-final.html)에서 같은 시각·크기로 찍는다 (계획서 10단계에서 생김). 사용법은 README.md.
// 그림: shots/mock-step10/<경우>.png(시안), shots/current-step10/<경우>.png(앱). blur 에 넣은 경우는 -blur.png 도.
// 경우
//   default  시안 기본(지하철역 묶음 1순위 A) ↔ 앱: 장소 지하철역, 경로 묶음 subway, 알림 없음(?inactivityMs=60000)
//   timeout  시안 ?left=15 ↔ 앱 ?inactivityMs=15000 (들어가자마자 15초 알림)
//   long     긴 경로(ROUTE_LONG, 9401-1 → 4 → 7011). 시안에는 이 경우가 없어 시안의 보내는 경로를 이 경로로 바꿔(주소 응답을 고쳐서) 찍는다.
//            시안의 요약 판은 모든 탈것을 노선 원으로 그리므로(버스 번호 모양 없음) 노선 줄은 다르게 나온다
//   loading·error  앱만. 만드는 중(가짜 시계를 흘리지 않음), 만들지 못함(mock 시나리오 qrError). 시안에 모양이 없다(12-5절)
//   pick1·pick2·pick3  앱만 (11단계). ROUTE_GUIDE 에서 N번 카드를 누르고 화면의 '휴대폰으로 보내기'로 들어간다(고른 경로가 요약 판에 나와야 한다)
// QR 무늬는 시안이 예시 무늬라 늘 다르다. 비교할 때 QR 상자 안(그림 480px)은 차이로 보지 않는다
async (page) => {
  const OPTIONS = {
    root: 'C:/Users/ckdal/Capstone_Design2/2026-2-CECD2-1-Oasis-04/.playwright-mcp/shots',
    app: 'http://localhost:5173/',
    mock: 'http://127.0.0.1:8800/design/mockups/confirmed/qr-handoff-final.html',
    blur: ['default', 'long'],
    mockShots: true,
    mockDir: 'mock-step10',
    appDir: 'current-step10',
    only: [], // 비우면 모든 경우. 예: ['pick1', 'pick2', 'pick3']
  }
  // 앱의 api/mock/data/routeCases.js ROUTE_LONG 과 같은 값
  const ROUTE_LONG = {"id":"long","durationMin":38,"start":{"name":"종로3가.탑골공원","kind":"STOP","dir":"ACROSS"},"legs":[{"mode":"BUS","kind":"EXPRESS","number":"9401-1","via":["종로5가","동대문","서울특별시립동대문역사문화공원.국립중앙의료원앞"],"to":{"name":"서울특별시립동대문역사문화공원.국립중앙의료원앞","kind":"STOP"}},{"mode":"WALK","minutes":4,"to":{"name":"동대문역사문화공원역","kind":"STATION"}},{"mode":"SUBWAY","lineId":"seoul-4","label":"4","via":["충무로"],"to":{"name":"충무로역","kind":"STATION"}},{"mode":"WALK","minutes":3,"to":{"name":"충무로역.매일경제","kind":"STOP","dir":"ACROSS"}},{"mode":"BUS","kind":"BRANCH","number":"7011","via":["퇴계로3가","명동입구"],"to":{"name":"명동입구","kind":"STOP"}}]}
  // 경우 → [시안 주소 뒤(null 이면 앱만), 앱 무입력 ms, 앱 장소, 앱 경로 묶음, 시안에 넣을 경로, 앱 시나리오, QR 을 만들 때까지 시계를 흘릴지]
  const ALL = {
    default: ['', 60000, 'subway', 'subway', null, 'normal', true],
    timeout: ['?left=15', 15000, 'subway', 'subway', null, 'normal', true],
    long: ['', 60000, 'subway', 'long', ROUTE_LONG, 'normal', true],
    loading: [null, 60000, 'subway', 'subway', null, 'normal', false],
    error: [null, 60000, 'subway', 'subway', null, 'qrError', true],
    // 8번째 값: ROUTE_GUIDE 에서 누를 카드 번호 (0 부터). 있으면 화면 버튼으로 보낸다
    pick1: [null, 60000, 'subway', 'subway', null, 'normal', true, 0],
    pick2: [null, 60000, 'subway', 'subway', null, 'normal', true, 1],
    pick3: [null, 60000, 'subway', 'subway', null, 'normal', true, 2],
  }
  const cases = Object.entries(ALL).filter(([name]) => !OPTIONS.only.length || OPTIONS.only.includes(name))

  await page.setViewportSize({ width: 1920, height: 1080 })
  // 움직임 줄이기로 찍는다: 움직이는 부분(마이크 고리, 음량 막대, 도는 호, 나타나기)이 멈춰 그림마다 같다 (10단계 전 보완)
  await page.emulateMedia({ reducedMotion: 'reduce' })
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
      const primary = stage.querySelectorAll('.btn-primary, .flow-btn-primary').length
      const scroll = [...stage.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY !== 'visible').length
      const top = stage.getBoundingClientRect().top
      const box = (el) => { const r = el.getBoundingClientRect(); return [+r.x.toFixed(1), +(r.y - top).toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)] }
      const rect = (sel) => { const el = stage.querySelector(sel); return el ? box(el) : null }
      const steps = [...stage.querySelectorAll('.qr-handoff-steps li, .steps li')].map(box)
      const qrModules = stage.querySelector('.qr-box svg')?.viewBox.baseVal.width ?? null
      const bottom = Math.max(...[...stage.querySelectorAll('*')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().bottom - top))
      return { minFont, maxFont, small, btns: btns.length, lowBtn, primary, bad: [...new Set(bad)], scroll, qr: rect('.qr-box'), qrModules, steps, summary: rect('.route-card.is-only, .summary'), bottom: Math.round(bottom) }
    })

  const out = []
  const snap = async (dir, name, sel) => {
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(150)
    await page.locator(sel).screenshot({ path: `${OPTIONS.root}/${dir}/${name}.png` })
    if (OPTIONS.blur.includes(name)) {
      await page.addStyleTag({ content: `${sel} > *{filter:blur(12px)}` })
      await page.locator(sel).screenshot({ path: `${OPTIONS.root}/${dir}/${name}-blur.png` })
      await page.evaluate(() => document.head.lastElementChild.remove())
    }
    out.push(`${dir}/${name} ${JSON.stringify(await measure())}`)
  }

  // ---- 시안 ----
  if (OPTIONS.mockShots) {
    for (const [name, [query, , , , inject]] of cases) {
      if (query === null) continue
      await page.unroute('**/qr-handoff-final.html*').catch(() => {})
      if (inject) {
        await page.route('**/qr-handoff-final.html*', async (route) => {
          const res = await route.fetch()
          const html = (await res.text()).replace('const route = window.ROUTE_SUBWAY.routes[0]', `const route = ${JSON.stringify(inject)}`)
          await route.fulfill({ response: res, body: html })
        })
      }
      await page.goto(OPTIONS.mock + query)
      await snap(OPTIONS.mockDir, name, 'section.screen')
    }
    await page.unroute('**/qr-handoff-final.html*').catch(() => {})
  }

  // ---- 앱 ----
  const ev = async (n) => {
    const ok = await page.evaluate((n) => { const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.startsWith(n + ' ')); if (!b) return false; b.click(); return true }, n)
    if (!ok) throw new Error('단추 없음 ' + n)
    await page.waitForTimeout(80)
  }
  const pick = (label, v) => page.evaluate(([l, v]) => {
    const sel = document.querySelector(`aside select[aria-label="${l}"]`)
    if (!sel) throw new Error('DevPanel 에 고르기가 없다: ' + l)
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, v)
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }, [label, v])

  for (const [name, [, ms, place, set, , scenario, settle, card]] of cases) {
    await page.goto(`${OPTIONS.app}?inactivityMs=${ms}`)
    await page.waitForSelector('.stage')
    await page.addStyleTag({ content: 'aside[aria-label="개발자 패널"]{display:none !important}' })
    await ev('HEALTH_OK')
    await pick('mock 장소', place)
    await page.clock.runFor(1000)
    await page.waitForTimeout(50)
    await pick('mock 시나리오', scenario)
    await ev('MANUAL_SELECT_PRESSED')
    await ev('POI_SELECTED')
    await pick('경로 묶음', set)
    await ev('ROUTE_FOUND')
    if (card === undefined) {
      await ev('SEND_TO_PHONE_PRESSED')
    } else {
      await page.locator('.stage button.route-card').nth(card).click()
      await page.locator('.stage').getByRole('button', { name: '휴대폰으로 보내기' }).click()
      await page.waitForTimeout(80)
    }
    if (settle) {
      // mock 지연(300~800ms) 뒤 QR 이 그려진다. 1초를 넘기면 알림 숫자가 14 가 되므로 850ms 만 흘린다
      await page.clock.runFor(850)
      await page.waitForTimeout(50)
    }
    await snap(OPTIONS.appDir, name, '.stage')
  }
  return out.join('\n')
}
