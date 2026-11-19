// 남은 시간 알림(디자인 문서 11-4절)을 무입력 화면 4개(CONFIRMING, REASKING, MANUAL_SELECT, UNAVAILABLE)에서 앱과 확정 시안으로 나란히 찍는다 (6단계에서 생김).
// 사용법은 README.md. Playwright MCP 의 browser_run_code(filename) 로 돌린다.
// 그림: shots/mock-step6/<화면>.png(시안 ?left=15), shots/current-step6/<화면>.png(앱), 둘 다 -blur.png 도.
//       긴 띠 이름(종로3가.탑골공원)은 <화면>-long.png.
// 앱은 주소 값 ?inactivityMs=15000 으로 무입력 시간을 15초로 줄여 들어가자마자 "15초" 알림이 보이게 한다 (config.js, 개발 모드만).
//   가짜 시계를 멈춰 두므로 숫자가 줄지 않는다. 찍기 전에 document 에 pointerdown 을 보내 타이머를 처음부터 다시 걸어 15 로 맞춘다.
// 돌려주는 숫자: 하한선(shoot-screens.js 와 같음), 알림 판 자리(x,y,w,h), 띠 높이, 띠 이름 오른쪽 끝과 판 왼쪽 끝 사이(gap, 음수면 겹침)
async (page) => {
  const OPTIONS = {
    root: 'C:/Users/ckdal/Capstone_Design2/2026-2-CECD2-1-Oasis-04/.playwright-mcp/shots',
    app: 'http://localhost:5173/?inactivityMs=15000',
    mock: 'http://127.0.0.1:8800/design/mockups/confirmed/',
    longPlace: '종로3가.탑골공원',
  }
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
      let small = 0
      const bad = []
      for (const el of stage.querySelectorAll('*')) {
        if (!hasText(el) || !el.getClientRects().length) continue
        const cs = getComputedStyle(el)
        if (parseFloat(cs.fontSize) < 30) small++
        const k = cs.color + '|' + bg(el); if (!ok.has(k)) bad.push(k)
      }
      const btns = [...stage.querySelectorAll('button')]
      const scroll = [...stage.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY !== 'visible').length
      const top = stage.getBoundingClientRect().top
      const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y - top), Math.round(r.width), Math.round(r.height)] }
      const alert = stage.querySelector('.timeout-notice') || stage.querySelector('.thin.is-timeout .thin-alert')
      const name = stage.querySelector('.thin-band-place') || stage.querySelector('.thin-place')
      const band = stage.querySelector('.thin-band') || stage.querySelector('.thin')
      const gap = alert && name ? Math.round(alert.getBoundingClientRect().left - name.getBoundingClientRect().right) : null
      return {
        small, btns: btns.length, lowBtn: btns.filter((b) => b.getBoundingClientRect().height < 112).length,
        primary: stage.querySelectorAll('.btn-primary').length, bad: [...new Set(bad)], scroll,
        alert: rect(alert), alertText: alert?.textContent.replace(/\s+/g, ' ').trim(), band: rect(band), name: rect(name), gap,
      }
    })

  const out = []
  const snap = async (dir, name, sel) => {
    await page.evaluate(() => document.fonts.ready)
    await page.locator(sel).screenshot({ path: `${OPTIONS.root}/${dir}/${name}.png` })
    if (!name.endsWith('-long')) {
      await page.addStyleTag({ content: `${sel} > *{filter:blur(12px)}` })
      await page.locator(sel).screenshot({ path: `${OPTIONS.root}/${dir}/${name}-blur.png` })
      await page.evaluate(() => document.head.lastElementChild.remove())
    }
    out.push(`${dir}/${name} ${JSON.stringify(await measure())}`)
  }

  // ---- 시안 ----
  const mocks = {
    '07-CONFIRMING': 'confirming-final.html', '09-REASKING': 'reasking-final.html',
    '10-MANUAL_SELECT': 'manual-select-final.html', '14-UNAVAILABLE': 'unavailable-final.html',
  }
  for (const [name, url] of Object.entries(mocks)) {
    await page.goto(`${OPTIONS.mock}${url}?left=15&freeze=0`); await snap('mock-step6', name, 'section.screen')
    await page.goto(`${OPTIONS.mock}${url}?left=15&freeze=0&place=${encodeURIComponent(OPTIONS.longPlace)}`); await snap('mock-step6', `${name}-long`, 'section.screen')
  }

  // ---- 앱 ----
  await page.goto(OPTIONS.app)
  await page.waitForSelector('.stage')
  await page.addStyleTag({ content: 'aside[aria-label="개발자 패널"]{display:none !important} .ring-arc{animation:none !important}' })
  const ev = async (n) => {
    const ok = await page.evaluate((n) => { const b = [...document.querySelectorAll('aside button')].find((x) => x.textContent.startsWith(n + ' ')); if (!b) return false; b.click(); return true }, n)
    if (!ok) throw new Error('DevPanel 에 단추가 없다: ' + n)
    await page.waitForTimeout(100)
  }
  // 타이머를 처음부터 다시 걸어 남은 초를 15 로 맞춘다 (화면을 누른 것과 같다)
  const rearm = async () => { await page.evaluate(() => document.dispatchEvent(new Event('pointerdown'))); await page.waitForTimeout(100) }
  const both = async (name) => {
    await rearm(); await snap('current-step6', name, '.stage')
    const prev = await page.evaluate((p) => { const el = document.querySelector('.thin-band-place'); const t = el.textContent; el.textContent = p; return t }, OPTIONS.longPlace)
    await snap('current-step6', `${name}-long`, '.stage')
    await page.evaluate((t) => { document.querySelector('.thin-band-place').textContent = t }, prev)
  }
  await ev('HEALTH_OK'); await page.clock.runFor(1000)
  await ev('MIC_BUTTON_PRESSED'); await ev('SPEECH_END'); await ev('RESOLVE_NEED_CONFIRM'); await both('07-CONFIRMING')
  await ev('CONFIRM_NONE_OF_THEM'); await ev('FAIL_COUNT_1'); await both('09-REASKING')
  await ev('MANUAL_SELECT_PRESSED'); await page.clock.runFor(1000); await both('10-MANUAL_SELECT')
  await ev('POI_SELECTED'); await ev('ROUTE_FAILED'); await both('14-UNAVAILABLE')
  return out.join('\n')
}
