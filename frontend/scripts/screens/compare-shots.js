// 그림 폴더 두 개를 같은 이름끼리 픽셀로 비교한다 (계획서 6-A절 2번 "바뀐 곳이 없는지").
// 먼저 serve-repo.mjs 를 켜 둔다. 사용법은 README.md. Playwright MCP 의 browser_run_code(filename) 로 돌린다.
//   a, b      저장소 루트 기준 폴더 (예: '.playwright-mcp/shots/base-step1', '.playwright-mcp/shots/current')
//   names     비교할 파일 이름 (.png 빼고)
//   threshold 한 픽셀에서 R·G·B 차이가 이 값보다 커야 "다름"으로 센다 (글자 가장자리의 미세한 차이 무시)
//   diffOut   다른 픽셀을 빨갛게 칠한 그림을 둘 폴더 (절대 경로). 비우면 만들지 않는다
// 돌려주는 것: 이름마다 다른 픽셀 수와 다른 곳을 감싼 상자(x, y, w, h)
async (page) => {
  const OPTIONS = {
    server: 'http://127.0.0.1:8800/',
    a: '.playwright-mcp/shots/base-step1',
    b: '.playwright-mcp/shots/current',
    names: [
      '01-STARTUP_CHECK', '02-CHECKING', '03-IDLE_REDUCED', '04-IDLE', '05-LISTENING', '06-RESOLVING', '07-CONFIRMING',
      '08-FAIL_COUNT_CHECK', '09-REASKING', '10-MANUAL_SELECT', '11-ROUTING', '12-ROUTE_GUIDE', '13-QR_HANDOFF', '14-UNAVAILABLE',
    ],
    threshold: 8,
    diffOut: '',
  }
  await page.goto(OPTIONS.server)
  const lines = []
  for (const name of OPTIONS.names) {
    const r = await page.evaluate(async ({ a, b, name, threshold }) => {
      const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('못 읽음 ' + src)); i.src = src + '?' + Date.now() })
      const [ia, ib] = await Promise.all([load(`/${a}/${name}.png`), load(`/${b}/${name}.png`)])
      if (ia.width !== ib.width || ia.height !== ib.height) return { size: `${ia.width}x${ia.height} / ${ib.width}x${ib.height}` }
      const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return [c, g, g.getImageData(0, 0, c.width, c.height)] }
      const [, , da] = px(ia)
      const [cb, gb, db] = px(ib)
      let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
      for (let i = 0; i < da.data.length; i += 4) {
        if (Math.abs(da.data[i] - db.data[i]) > threshold || Math.abs(da.data[i + 1] - db.data[i + 1]) > threshold || Math.abs(da.data[i + 2] - db.data[i + 2]) > threshold) {
          n++
          const p = i / 4, x = p % ia.width, y = (p / ia.width) | 0
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
          db.data[i] = 255; db.data[i + 1] = 0; db.data[i + 2] = 0
        }
      }
      gb.putImageData(db, 0, 0)
      return { n, box: n ? [x0, y0, x1 - x0 + 1, y1 - y0 + 1] : null, diff: n ? cb.toDataURL('image/png') : null }
    }, { a: OPTIONS.a, b: OPTIONS.b, name, threshold: OPTIONS.threshold })
    if (r.size) { lines.push(`${name}: 크기 다름 ${r.size}`); continue }
    lines.push(`${name}: ${r.n}px${r.box ? ' 상자 ' + r.box.join(',') : ''}`)
    if (OPTIONS.diffOut && r.diff) {
      // 빨갛게 칠한 그림을 새 탭에 띄워 그 탭을 찍어서 저장한다 (이 함수 안에서는 파일을 직접 쓸 수 없다)
      const tab = await page.context().newPage()
      await tab.setViewportSize({ width: 1920, height: 1080 })
      await tab.setContent(`<body style="margin:0"><img src="${r.diff}"></body>`)
      await tab.screenshot({ path: `${OPTIONS.diffOut}/${name}-diff.png` })
      await tab.close()
    }
  }
  return lines.join('\n')
}
