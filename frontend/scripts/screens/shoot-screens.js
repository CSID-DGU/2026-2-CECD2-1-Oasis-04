// 실제 앱 14화면을 1920×1080 으로 찍고 하한선을 잰다 (계획서 docs/design-implementation-plan.md 6-A절).
// 사용법은 같은 폴더의 README.md. Playwright MCP 의 browser_run_code(filename) 로 이 파일을 그대로 돌린다.
//
// 이 파일은 함수 하나다. Playwright 가 page 를 넘겨 부른다. 바꿀 것은 맨 위 OPTIONS 뿐이다.
//   out      그림을 둘 폴더 (저장소 루트 기준이 아니라 절대 경로가 안전하다. .playwright-mcp/ 아래는 git 이 무시한다)
//   url      개발 서버 주소 (npm run dev, mock 모드)
//   measure  true 면 화면마다 하한선 숫자를 함께 돌려준다
//   blur     흐림(12px) 그림도 찍을 화면 번호. 예: ['05']. 시선 순서 검사용 (3-9절)
//   only     찍을 화면 번호만. 비우면 14개 모두. 화면을 지나가는 순서는 같고 저장만 고른다
//   stopArcs true 면 도는 호(.ring-arc)를 처음 자리(12시)에 멈춘다. 가짜 시계는 CSS 움직임을 멈추지 않아서
//            그대로 찍으면 호의 자리가 그림마다 다르다. 시안은 ?freeze=0 으로 찍으면 같은 자리다 (3단계에서 생김)
//   reasons  UNAVAILABLE 을 이유별로 더 찍는다: 14-UNAVAILABLE-<이유>.png. 이유 이름은 DevPanel 의 '오류 이유' 목록
//            (noroute, close, scope, upstream, generic, nopoi, long). 비우면 찍지 않는다
//   extras   true 면 들은 말이 빈 REASKING(09-REASKING-empty)과 RESOLVING(06-RESOLVING-empty)도 찍는다 (4단계에서 생김)
//
// 하는 일: 가짜 시계를 2026-11-19 오후 2:30 에 멈추고(띠의 시각·움직임이 그림마다 같게), DevPanel 을 숨긴 뒤
// DevPanel 의 이벤트 단추("EVENT → NEXT")를 눌러 14상태를 차례로 지나며 무대(.stage)만 찍는다.
async (page) => {
  const OPTIONS = {
    out: 'C:/Users/ckdal/Capstone_Design2/2026-2-CECD2-1-Oasis-04/.playwright-mcp/shots/current',
    url: 'http://localhost:5173/',
    measure: true,
    blur: ['05'],
    only: [],
    stopArcs: true,
    reasons: ['noroute', 'close', 'scope', 'upstream', 'generic'],
    extras: true,
  }

  await page.setViewportSize({ width: 1920, height: 1080 })
  // 움직임 줄이기로 찍는다: 움직이는 부분(마이크 고리, 음량 막대, 도는 호, 나타나기)이 멈춰 그림마다 같다 (10단계 전 보완)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const T0 = new Date('2026-11-19T14:30:00').getTime()
  await page.clock.install({ time: T0 })
  await page.clock.pauseAt(T0 + 10)
  await page.goto(OPTIONS.url)
  await page.waitForSelector('.stage')
  await page.addStyleTag({ content: 'aside[aria-label="개발자 패널"]{display:none !important}' })
  if (OPTIONS.stopArcs) await page.addStyleTag({ content: '.ring-arc{animation:none !important}' })
  await page.evaluate(() => document.fonts.ready)

  // DevPanel 이벤트 단추 누르기. 단추 글자는 "EVENT → NEXT" 모양이다 (components/DevPanel.jsx)
  const ev = async (name) => {
    const ok = await page.evaluate((n) => {
      const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.startsWith(n + ' '))
      if (!b) return false
      b.click()
      return true
    }, name)
    if (!ok) throw new Error('DevPanel 에 단추가 없다: ' + name)
    await page.waitForTimeout(100)
  }

  // 하한선 검사 (디자인 문서 2절, 3-2절 허용 조합). 무대 안 글자가 있는 요소마다 글씨 크기와 글씨|배경 색을 본다
  const measure = () =>
    page.evaluate(() => {
      const ok = new Set([
        'rgb(17, 17, 17)|rgb(255, 255, 255)',
        'rgb(140, 29, 24)|rgb(255, 255, 255)',
        'rgb(255, 255, 255)|rgb(10, 74, 159)',
        'rgb(17, 17, 17)|rgb(242, 242, 242)',
        'rgb(17, 17, 17)|rgb(234, 242, 252)',
        'rgb(255, 255, 255)|rgb(17, 17, 17)',
      ])
      const bg = (el) => {
        for (let e = el; e; e = e.parentElement) {
          const c = getComputedStyle(e).backgroundColor
          if (c !== 'rgba(0, 0, 0, 0)') return c
        }
        return 'rgb(255, 255, 255)'
      }
      const stage = document.querySelector('.stage')
      const hasText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
      let small = 0
      let minFont = 999
      const bad = []
      for (const el of stage.querySelectorAll('*')) {
        if (!hasText(el) || !el.getClientRects().length) continue
        const cs = getComputedStyle(el)
        const f = parseFloat(cs.fontSize)
        minFont = Math.min(minFont, f)
        if (f < 30) small++
        const k = cs.color + '|' + bg(el)
        if (!ok.has(k)) bad.push(k)
      }
      const btns = [...stage.querySelectorAll('button')]
      const lowBtn = btns.filter((b) => b.getBoundingClientRect().height < 112).length
      const primary = stage.querySelectorAll('.btn-primary, .flow-btn-primary').length
      const scroll = [...stage.querySelectorAll('*')].filter(
        (e) => e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY !== 'visible',
      ).length
      return { minFont, small, btns: btns.length, lowBtn, primary, bad: [...new Set(bad)], scroll }
    })

  const results = []
  const shot = async (name, settle = 0) => {
    if (settle) await page.clock.runFor(settle)
    const no = name.slice(0, 2)
    const state = await page.evaluate(() => document.querySelector('aside')?.textContent.match(/state\s*([A-Z_]+)/)?.[1])
    const row = { name, state }
    if (!OPTIONS.only.length || OPTIONS.only.includes(no)) {
      await page.locator('.stage').screenshot({ path: `${OPTIONS.out}/${name}.png` })
      if (OPTIONS.blur.includes(no)) {
        await page.addStyleTag({ content: '.stage > *{filter:blur(12px)}' })
        await page.locator('.stage').screenshot({ path: `${OPTIONS.out}/${name}-blur.png` })
        await page.evaluate(() => document.head.lastElementChild.remove())
      }
      if (OPTIONS.measure) row.measure = await measure()
    }
    results.push(row)
  }

  await shot('01-STARTUP_CHECK')
  await ev('HEALTH_SERVER_DOWN'); await shot('02-CHECKING')
  await ev('HEALTH_RETRY_TIMER'); await ev('MIC_OR_STT_UNAVAILABLE'); await shot('03-IDLE_REDUCED', 1000)
  await ev('MANUAL_SELECT_PRESSED'); await ev('GO_HOME')
  await ev('MIC_BUTTON_PRESSED'); await ev('LISTEN_CANCEL'); await shot('04-IDLE', 1000)
  await ev('MIC_BUTTON_PRESSED'); await shot('05-LISTENING')
  await ev('SPEECH_END'); await shot('06-RESOLVING')
  await ev('RESOLVE_NEED_CONFIRM'); await shot('07-CONFIRMING')
  await ev('CONFIRM_NONE_OF_THEM'); await shot('08-FAIL_COUNT_CHECK')
  await ev('FAIL_COUNT_1'); await shot('09-REASKING')
  await ev('MANUAL_SELECT_PRESSED'); await shot('10-MANUAL_SELECT', 1000)
  await ev('POI_SELECTED'); await shot('11-ROUTING')
  await ev('ROUTE_FOUND'); await shot('12-ROUTE_GUIDE')
  await ev('SEND_TO_PHONE_PRESSED'); await shot('13-QR_HANDOFF', 1000)
  await ev('GO_HOME'); await ev('MANUAL_SELECT_PRESSED'); await ev('POI_SELECTED'); await ev('ROUTE_FAILED'); await shot('14-UNAVAILABLE')
  // 이유별 UNAVAILABLE: DevPanel 의 '오류 이유' 를 고르고 ROUTE_FAILED 로 다시 들어온다
  const pickReason = (value) =>
    page.evaluate((v) => {
      const sel = document.querySelector('aside select[aria-label="오류 이유"]')
      const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
      set.call(sel, v)
      sel.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
  for (const reason of OPTIONS.reasons) {
    await ev('GO_HOME'); await pickReason(reason); await ev('MANUAL_SELECT_PRESSED'); await ev('POI_SELECTED'); await ev('ROUTE_FAILED')
    await shot(`14-UNAVAILABLE-${reason}`)
  }
  if (OPTIONS.reasons.length) await pickReason('')

  // 들은 말이 빈 경우: DevPanel 입력 없이 화면의 '다 말했어요' 를 누르면 빈 글로 SPEECH_END 가 나간다
  if (OPTIONS.extras) {
    await ev('GO_HOME'); await ev('MIC_BUTTON_PRESSED')
    await page.locator('.stage').getByRole('button', { name: '다 말했어요' }).click(); await page.waitForTimeout(100)
    await shot('06-RESOLVING-empty')
    await ev('RESOLVE_NOT_UNDERSTOOD'); await ev('FAIL_COUNT_1'); await shot('09-REASKING-empty')
  }

  return results.map((r) => `${r.name} (${r.state})${r.measure ? ' ' + JSON.stringify(r.measure) : ''}`).join('\n')
}
