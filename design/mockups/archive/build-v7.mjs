// v7 을 만든다. 실행: design/mockups 에서 `node build-v7.mjs`
//   v7-band.js   v6-band.js 의 구조(양 끝까지 이어지는 선, 가운데 이름판, 평평한 표지)는 그대로 두고
//                색만 v5 처럼 옅게 바꾼다 (흰색을 섞는다. 주 버튼과 비슷한 파랑은 더 옅게)
//   v7-*.html    세 장. 장소 정보(window.PLACE)는 v4-*.html 의 것을 그대로 가져온다
import { readFileSync, writeFileSync } from 'node:fs'

// ---------- 띠 부품 ----------
let band = readFileSync('v6-band.js', 'utf8')
const rep = (from, to) => {
  if (!band.includes(from)) throw new Error('v6-band.js 에서 찾지 못함: ' + from.slice(0, 50))
  band = band.split(from).join(to)
}
rep(
  '// 역명판 띠 부품 (시안). 장소 정보(window.PLACE)를 받아 .v6-band 안을 그린다.',
  '// (build-v7.mjs 가 v6-band.js 에서 만든 파일. 직접 고치지 않는다)\n// 역명판 띠 부품 (시안). 장소 정보(window.PLACE)를 받아 .v7-band 안을 그린다.\n// v6 과 구조는 같고 색만 옅다: 선은 원래 색의 30%(주 버튼과 비슷한 파랑은 20%), 고리는 60%(45%).',
)
rep(
  '/** 선 n 개의 높이.',
  `const css = getComputedStyle(document.documentElement)
const token = (name) => css.getPropertyValue(name).trim()
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
/** 색에 흰색을 섞는다. amount 는 원래 색이 남는 비율 (0~1). */
const tint = (hex, amount) => '#' + rgb(hex).map((c) => Math.round(255 + (c - 255) * amount).toString(16).padStart(2, '0')).join('')
/** 주 버튼 파랑과 비슷한 색인지 (1호선, 간선버스). 비슷하면 더 옅게 쓴다 */
function nearPrimary(hex) {
  const [a, b] = [rgb(hex), rgb(token('--color-primary'))]
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 70
}
/** 토큰 이름 → 선 색과 고리 색 (v5 와 같은 비율) */
function shades(tokenName) {
  const hex = token(tokenName)
  const soft = nearPrimary(hex)
  return { band: tint(hex, soft ? 0.2 : 0.3), ring: tint(hex, soft ? 0.45 : 0.6) }
}

/** 선 n 개의 높이.`,
)
// 지하철: 선은 옅은 색, 고리는 그보다 조금 진한 색
rep('  const color = (l) => `var(--line-${l.lineId})`\n', '  const shade = (l) => shades(`--line-${l.lineId}`)\n')
rep('svg: lines.map((l, i) => line(ys[i], color(l))).join(\'\'),', "svg: lines.map((l, i) => line(ys[i], shade(l).band)).join(''),")
rep('style="--c:${color(l)};top:${ys[i]}px">${l.label}</span>`', 'style="--c:${shade(l).ring};top:${ys[i]}px">${l.label}</span>`')
rep('(l.stationNo ? circle(l.stationNo, color(l)) : \'\')', "(l.stationNo ? circle(l.stationNo, shade(l).ring) : '')")
// 버스
rep('line(ys[i], `var(${BUS_KINDS[g.kind].token})`)', 'line(ys[i], shades(BUS_KINDS[g.kind].token).band)')
rep('circle(l.label, `var(--line-${l.lineId})`)', 'circle(l.label, shades(`--line-${l.lineId}`).ring)')
rep('<div class="v6-sub"><span>가까운 지하철</span>', '<div class="v6-sub is-near"><span>가까운 지하철</span>')
rep('v6-', 'v7-')
writeFileSync('v7-band.js', band)

// ---------- 세 장 ----------
const mic = readFileSync('../shared/icons/mic.svg', 'utf8')
const micSvg = `<svg viewBox="${mic.match(/viewBox="([^"]+)"/)[1]}" aria-hidden="true">${mic.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg>`
const placeOf = (file) => readFileSync(file, 'utf8').match(/window\.PLACE = ([\s\S]*?)\n    <\/script>/)[1]

const page = (title, note, place) => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <link rel="stylesheet" href="../shared/base.css" />
    <link rel="stylesheet" href="v7.css" />
  </head>
  <body>
    <!-- (build-v7.mjs 가 만든 파일) 가로 캔버스 1920×1080. 세 파일(v7-subway / v7-bus / v7-default)은 아래 PLACE 값만 다르다 -->
    <!-- ${note} -->
    <script>
      window.PLACE = ${place}
    </script>

    <section class="screen" data-screen="IDLE">
      <!-- 역명판 띠: 지금 계신 곳 표시를 겸한다. 안쪽은 v7-band.js 가 그린다 -->
      <header class="v7-band" data-zone="band">
        <div class="v7-lines"></div>
        <div class="v7-brand">
          <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" aria-hidden="true">
            <circle cx="28" cy="28" r="20" stroke-width="9" />
            <circle cx="28" cy="28" r="5" fill="currentColor" stroke="none" />
          </svg>
          <span>말길</span>
        </div>
        <div class="v7-note"></div>
        <div class="v7-now"><span data-date>11월 16일 월요일</span> <span data-clock>오후 2:30</span></div>
        <div class="v7-plate"></div>
      </header>

      <!-- 본문 왼쪽: 질문과 예시. 주 버튼과 세로 가운데를 맞춘다 -->
      <main class="v7-left">
        <div data-zone="content">
          <h1 class="v7-question v3-core">어디로 가시나요?</h1>
          <p class="v7-say-label">이렇게 말해 보세요</p>
          <ul class="v7-says">
            <li>“명동 어떻게 가요?”</li>
            <li>“서울역 가는 버스”</li>
            <li>“가까운 병원”</li>
          </ul>
        </div>
      </main>

      <!-- 본문 오른쪽: 버튼 묶음 -->
      <div class="v7-actions" data-zone="actions">
        <button type="button" class="btn btn-primary">
          <span class="v7-mic">${micSvg}</span>
          <span>말하기</span>
        </button>
        <button type="button" class="btn btn-secondary">손으로 고르기</button>
      </div>
    </section>

    <script src="../shared/mock.js"></script>
    <script src="../shared/v3.js"></script>
    <script src="v7-band.js"></script>
  </body>
</html>
`
writeFileSync('v7-subway.html', page('시안 v7. IDLE 가로 (지하철역: 종로3가역)', '역 번호와 노선색은 공식 자료로 확인하지 않았다', placeOf('v4-subway.html')))
writeFileSync('v7-bus.html', page('시안 v7. IDLE 가로 (버스정류장: 종로3가.탑골공원 정류장)', '버스 번호는 예시다 (example: true 이면 띠 위쪽 줄에 예시라고 표시된다)', placeOf('v4-bus.html')))
writeFileSync('v7-default.html', page('시안 v7. IDLE 가로 (장소 정보 없음)', '장소 정보가 없거나 불러오지 못했을 때의 모습', placeOf('v4-default.html')))
console.log('v7-band.js 와 v7 세 장을 만들었습니다')
