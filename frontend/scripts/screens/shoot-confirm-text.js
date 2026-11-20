// CONFIRMING 의 서버 질문(confirmText)을 길이별로 찍는다 (2026-11-20 생김). 사용법은 README.md.
// 경우: 후보 묶음 one(1개)·hospital(3개)·long(긴 이름 3개) × 질문 문구 none·short·len40·len80. 그림: shots/confirm-text/<묶음>-<문구>.png
// 돌려주는 숫자: shoot-pick.js 와 같은 하한선 + 안내 줄(.confirm-lead) 줄 수·크기, 카드 자리, 가장 아래 끝(넘침 확인)
async (page) => {
  const ROOT = 'C:/Users/ckdal/Capstone_Design2/2026-2-CECD2-1-Oasis-04/.playwright-mcp/shots'
  const APP = 'http://localhost:5180/?inactivityMs=60000'
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
      const prim = [...stage.querySelectorAll('.btn-primary')]
      const scroll = [...stage.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 && getComputedStyle(e).overflowY !== 'visible').length
      const top = stage.getBoundingClientRect().top
      const rect = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y - top), Math.round(r.width), Math.round(r.height)] }
      const cards = [...stage.querySelectorAll('.pick')].map((c) => {
        const n = c.querySelector('.pick-name'); const lines = Math.round(n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).lineHeight))
        return `${n.textContent}:${lines}줄 ${rect(c).join(',')}`
      })
      const bottom = Math.max(...[...stage.querySelectorAll('*')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().bottom - top))
      const lead = stage.querySelector(".confirm-lead"); const leadInfo = lead && { font: parseFloat(getComputedStyle(lead).fontSize), lines: Math.round(lead.getBoundingClientRect().height / parseFloat(getComputedStyle(lead).lineHeight)), rect: rect(lead), text: lead.textContent.length }
      const leftOver = [...stage.querySelectorAll(".confirm *")].filter((e) => e.getClientRects().length && e.getBoundingClientRect().bottom - top > 1080 - 1).length
      return { lead: leadInfo, leftOver, minFont, maxFont, small, btns: btns.length, lowBtn, primary: prim.length, primaryRect: prim.map(rect), bad: [...new Set(bad)], scroll, bottom: Math.round(bottom), cards }
    })

  const out = []
  const snap = async (name) => {
    await page.evaluate(() => document.fonts.ready)
    await page.locator('.stage').screenshot({ path: `${ROOT}/confirm-text/${name}.png` })
    out.push(`${name} ${JSON.stringify(await measure())}`)
  }
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

  await ev('HEALTH_OK')
  for (const set of ['one', 'hospital', 'long']) {
    for (const text of ['', 'short', 'len40', 'len80']) {
      await say('병원'); await pick('후보 묶음', set); await pick('질문 문구', text); await ev('RESOLVE_NEED_CONFIRM')
      await snap(`${set}-${text || 'none'}`)
      await page.clock.runFor(1000); await ev('GO_HOME')
    }
  }
  return out.join('\n')
}
