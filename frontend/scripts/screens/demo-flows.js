// 시연 모드 다섯 흐름을 실제 앱에서 처음부터 끝까지 돌리는 시험 (옮기기 계획 13단계).
// 사용법은 같은 폴더의 README.md. Playwright MCP 의 browser_run_code(filename) 로 이 파일을 그대로 돌린다.
//
// 준비: frontend/ 에서 npm run dev:demo (5173 을 쓰고 있으면 npx vite --mode demo --port 5182 --strictPort 처럼 다른 자리에)
//
// 하는 일
//   1. 확정 시안 demo.html 을 file:// 로 열어 그 안의 FLOWS 에서 흐름마다 화면 순서를 읽는다 (기대값)
//   2. 시연 앱을 열고, 화면에 보이지 않는 DevPanel 의 'state' 줄을 지켜보며 상태가 바뀔 때마다 시각과 함께 적는다
//      (DevPanel 은 Ctrl+Shift+D 로 켜고 CSS 로 숨긴다. 발표자 키는 입력창에 포커스가 있으면 동작하지 않기 때문)
//   3. 흐름마다 숫자 키로 시작해 → 키만 눌러 끝까지 간다. 기다림 화면(RESOLVING, ROUTING, FAIL_COUNT_CHECK)은 누르지 않고
//      저절로 넘어가길 기다린다. 지나간 화면 순서가 demo.html 과 같은지, 기다림 화면이 1초 넘게 보였는지,
//      마지막 화면에서 → 가 아무것도 안 하는지 본다
//   4. ← (이전), Home (처음), 손으로 누르기(4번 흐름을 화면 버튼으로), LISTENING 음량 막대가 움직이는지 본다
//   5. 콘솔의 "표에 없는 전이" 경고 수를 센다
// 돌려주는 값: { ok, flows: [{ name, expected, seen, ok, waits }], checks: {...}, badTransitions }
async (page) => {
  const OPTIONS = {
    url: 'http://localhost:5182/',
    demoHtml: 'file:///C:/Users/ckdal/Capstone_Design2/2026-2-CECD2-1-Oasis-04/design/mockups/confirmed/demo.html',
    minWaitMs: 1000, // 기다림 화면이 적어도 이만큼 보여야 한다
    stepTimeoutMs: 8000,
  }
  const WAIT = new Set(['RESOLVING', 'ROUTING', 'FAIL_COUNT_CHECK'])

  // 1. demo.html 의 FLOWS 를 읽는다: const FLOWS = [ ... ].map( 사이에서 흐름마다 ['STATE' 를 모은다
  await page.goto(OPTIONS.demoHtml)
  const source = await page.evaluate(() => [...document.scripts].map((s) => s.textContent).join('\n'))
  const block = source.slice(source.indexOf('const FLOWS = ['), source.indexOf('].map((flow)'))
  const expected = block
    .split(/\n\s*\{\s*\n/)
    .slice(1)
    .map((part) => ({
      name: part.match(/name: '([^']+)'/)[1],
      states: [...part.matchAll(/\['([A-Z_]+)'/g)].map((m) => m[1]),
    }))

  // 2. 시연 앱
  const badTransitions = []
  page.on('console', (msg) => {
    if (msg.text().includes('표에 없는 전이')) badTransitions.push(msg.text())
  })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(OPTIONS.url)
  await page.waitForSelector('.stage')
  const panelHiddenAtStart = (await page.locator('aside[aria-label="개발자 패널"]').count()) === 0
  await page.keyboard.press('Control+Shift+D')
  await page.addStyleTag({ content: 'aside[aria-label="개발자 패널"]{display:none !important}' })
  await page.evaluate(() => {
    const aside = document.querySelector('aside[aria-label="개발자 패널"]')
    const read = () => aside.querySelector('div').textContent.replace(/^state\s*/, '').trim()
    window.__log = [{ s: read(), t: performance.now() }]
    new MutationObserver(() => {
      const s = read()
      if (s !== window.__log.at(-1).s) window.__log.push({ s, t: performance.now() })
    }).observe(aside, { subtree: true, childList: true, characterData: true })
  })
  const current = () => page.evaluate(() => window.__log.at(-1).s)
  const waitState = async (want, timeout = OPTIONS.stepTimeoutMs) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if ((await current()) === want) return true
      await page.waitForTimeout(30)
    }
    return false
  }
  const waitChange = async (from, timeout = OPTIONS.stepTimeoutMs) => {
    const n = await page.evaluate(() => window.__log.length)
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if ((await page.evaluate(() => window.__log.length)) > n || (await current()) !== from) return true
      await page.waitForTimeout(30)
    }
    return false
  }
  await waitState('IDLE')

  // 3. 흐름 다섯 가지
  const flows = []
  for (const [f, exp] of expected.entries()) {
    await page.keyboard.press(String(f + 1))
    await waitState(exp.states[0])
    await page.evaluate(() => (window.__log = [{ s: window.__log.at(-1).s, t: performance.now() }]))
    for (let i = 0; i < exp.states.length - 1; i++) {
      const here = await current()
      if (!WAIT.has(here)) await page.keyboard.press('ArrowRight')
      if (!(await waitChange(here))) break
      await page.waitForTimeout(250) // 화면이 그려지는 것을 기다린다
    }
    // 마지막 화면에서 → 는 아무 일도 하지 않는다
    const before = await page.evaluate(() => window.__log.length)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(500)
    const stayed = (await page.evaluate(() => window.__log.length)) === before
    const log = await page.evaluate(() => window.__log)
    const seen = log.map((e) => e.s)
    const waits = log
      .map((e, i) => ({ state: e.s, ms: Math.round((log[i + 1]?.t ?? e.t) - e.t) }))
      .filter((w) => WAIT.has(w.state))
    flows.push({
      name: exp.name,
      expected: exp.states.join(' → '),
      seen: seen.join(' → '),
      ok: seen.join() === exp.states.join() && stayed && waits.every((w) => w.ms >= OPTIONS.minWaitMs),
      lastStays: stayed,
      waits,
    })
  }

  // 4. 그 밖의 확인
  const checks = {}
  // ← 와 Home: 1번 흐름 QR_HANDOFF 에서 ← → ROUTE_GUIDE, Home → IDLE
  await page.keyboard.press('1')
  await waitState('IDLE')
  for (const want of ['LISTENING', 'RESOLVING', 'CONFIRMING', 'ROUTING', 'ROUTE_GUIDE', 'QR_HANDOFF']) {
    const here = await current()
    if (!WAIT.has(here)) await page.keyboard.press('ArrowRight')
    await waitState(want)
  }
  await page.keyboard.press('ArrowLeft')
  checks.prevFromQr = (await waitState('ROUTE_GUIDE', 1000)) ? 'ROUTE_GUIDE' : await current()
  await page.keyboard.press('ArrowLeft') // 앞은 기다림 화면 ROUTING. 그 화면에 서고 저절로 ROUTE_GUIDE 로 간다
  checks.prevToWait = (await waitState('ROUTING', 1000)) ? 'ROUTING' : await current()
  checks.prevWaitAdvances = await waitState('ROUTE_GUIDE')
  await page.keyboard.press('Home')
  checks.home = (await waitState('IDLE', 1000)) ? 'IDLE' : await current()

  // LISTENING 음량 막대가 움직이는지 (막대 끝 좌표가 시간에 따라 바뀐다)
  await page.keyboard.press('2')
  await waitState('LISTENING')
  const bars = () => page.evaluate(() => [...document.querySelectorAll('.stage svg line')].map((l) => l.getAttribute('x2')).join())
  const b1 = await bars()
  await page.waitForTimeout(400)
  checks.meterMoves = b1 !== '' && b1 !== (await bars())
  // 화면의 '다 말했어요' 도 정해진 문장을 보낸다 (2번 흐름: 웅얼웅얼 → 못 알아들음 → REASKING)
  await page.getByRole('button', { name: '다 말했어요' }).click()
  checks.touchSpeechReask = await waitState('REASKING')

  // 손으로 누르기: 4번 흐름을 화면 버튼으로 지나간다
  await page.keyboard.press('4')
  await waitState('IDLE')
  await page.getByRole('button', { name: '손으로 고르기' }).click()
  await waitState('MANUAL_SELECT')
  await page.getByRole('button', { name: /명동역/ }).click()
  checks.touchFlow4 = await waitState('ROUTE_GUIDE')
  // 손으로 넘어간 뒤에도 키가 따라간다: ← 는 바로 앞 화면 ROUTING (기다림 화면이라 다시 ROUTE_GUIDE 로 간다)
  await page.keyboard.press('ArrowLeft')
  checks.prevAfterTouch = (await waitState('ROUTING', 1000)) ? 'ROUTING' : await current()

  checks.panelHiddenAtStart = panelHiddenAtStart
  const ok =
    flows.every((f) => f.ok) &&
    badTransitions.length === 0 &&
    checks.prevFromQr === 'ROUTE_GUIDE' &&
    checks.prevToWait === 'ROUTING' &&
    checks.prevWaitAdvances &&
    checks.home === 'IDLE' &&
    checks.meterMoves &&
    checks.touchSpeechReask &&
    checks.touchFlow4 &&
    checks.prevAfterTouch === 'ROUTING' &&
    panelHiddenAtStart
  return { ok, flows, checks, badTransitions }
}
