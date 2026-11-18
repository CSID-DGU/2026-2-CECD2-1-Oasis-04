// v8 을 v7 에서 만든다. 실행: design/mockups 에서 `node build-v8.mjs`
// v7 과 같은 것: 배경 두 구역, 옅은 노선 색, 띠의 선·표지·원.
// v8 에서 바뀐 것:
//   1. 버튼 칸 너비 520 → 740px. 주 버튼 740×500, 보조 버튼 740×160(손가락 아이콘, 글씨 48px)
//   2. 질문 묶음의 왼쪽 끝은 --question-left(140px). 띠 안 이름판은 화면 가로 가운데 그대로다
//   3. 질문 묶음의 세로 가운데를 버튼 묶음의 세로 가운데에 맞춘다
//   4. 예시 세 줄 48 → 52px
import { readFileSync, writeFileSync } from 'node:fs'

const editor = (text, name) => {
  const api = {
    text,
    rep(from, to) {
      if (!api.text.includes(from)) throw new Error(`${name} 에서 찾지 못함: ${from.slice(0, 50)}`)
      api.text = api.text.split(from).join(to)
      return api
    },
  }
  return api
}

// ---------- 스타일 ----------
const css = editor(readFileSync('v7.css', 'utf8'), 'v7.css')
  .rep('/* v7 — IDLE 가로(1920×1080). 배경은 두 구역뿐이다.', '/* (build-v8.mjs 가 v7.css 에서 만든 파일. 직접 고치지 않는다)\n * v8 — IDLE 가로(1920×1080). 배경은 두 구역뿐이다.')
  .rep(
    '  --actions-width: 520px;',
    '  --actions-width: 740px;\n  /* 질문 묶음(질문, "이렇게 말해 보세요", 예시 세 줄)의 왼쪽 끝. 140px 로 확정 (2026-11-16).\n     띠 안의 앞 역 이름 글자("종각", "안국", "광화문")가 시작하는 세로선(138px)과 거의 같다.\n     주소에 ?ql=220 처럼 붙이면 파일을 고치지 않고 다른 값으로 볼 수 있다 */\n  --question-left: 140px;',
  )
  .rep('  --btn-primary-height: 520px;', '  --btn-primary-height: 500px;\n  --btn-secondary-height: 160px;')
  .rep('/* 버튼 묶음(주 버튼 520 + 턱 12 + 간격 24 + 보조 버튼 112 = 668)을 본문(높이 800) 세로 가운데에 둔다 */', '/* 버튼 묶음(주 버튼 500 + 턱 12 + 간격 24 + 보조 버튼 160 = 696)을 본문(높이 800) 세로 가운데에 둔다 */\n  --actions-height: 696px;')
  .rep('(var(--canvas-height) - var(--band-height) - 668px) / 2', '(var(--canvas-height) - var(--band-height) - var(--actions-height)) / 2')
  .rep('  --font-primary: 80px; /* 주 버튼 글씨 */', '  --font-primary: 104px; /* 주 버튼 글씨. 화면에서 가장 큰 글씨 */\n  --font-say: 52px; /* 예시 세 줄 */')
  .rep('  --mic-size: 128px;', '  --mic-size: 152px;\n  --hand-size: 64px;')
  // 이름판은 v7 그대로 화면 가로 가운데(중심 x = 960px)에 둔다
  // 질문 묶음: --question-left 에서 시작하고, 버튼 묶음과 세로 가운데를 맞춘다
  .rep(
    `/* 주 버튼과 같은 높이의 자리. 그 안에서 묶음을 세로 가운데, 가로 가운데에 둔다 */
.v7-left {
  position: absolute;
  top: var(--actions-top);
  left: var(--pad);
  right: calc(var(--pad) + var(--actions-width) + var(--pad));
  height: var(--btn-primary-height);
  display: flex;
  align-items: center;
  justify-content: center;
}`,
    `/* 버튼 묶음과 같은 높이의 자리. 그 안에서 묶음을 세로 가운데에 둔다. 왼쪽 끝은 --question-left */
.v7-left {
  position: absolute;
  top: var(--actions-top);
  left: var(--question-left);
  height: var(--actions-height);
  display: flex;
  align-items: center;
}`,
  )
  .rep('  font-size: var(--font-title);\n  line-height: 1.35;\n  white-space: nowrap;', '  font-size: var(--font-say);\n  line-height: 1.35;\n  white-space: nowrap;')
  // 보조 버튼: 높이 160, 글씨 한 단계 크게, 손가락 아이콘. 테두리와 흰 바탕은 그대로
  .rep(
    `.screen .v7-actions .btn-secondary {
  border: 2px solid var(--color-text-sub);
}`,
    `.screen .v7-actions .btn-secondary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  min-height: var(--btn-secondary-height);
  font-size: var(--font-title);
  border: 2px solid var(--color-text-sub);
  border-radius: 24px;
}

.v7-hand {
  width: var(--hand-size);
  height: var(--hand-size);
  fill: currentColor;
}`,
  )
  // 이름판: 이름만 남긴다(역 번호 원, 가까운 지하철 줄 없음). 이름 크기는 --place-name-size 하나로 정하고,
  // 상자 높이와 띠 높이가 그 값을 따라 늘어난다. 이름은 상자 안에서 세로 가운데다 (상자가 flex 가운데 정렬)
  .rep(
    '  --band-height: 280px;',
    `  /* 역·정류장 이름의 글씨 크기. 이 숫자만 바꾸면 이름 상자와 띠의 높이, 노선 선의 간격, 본문의 세로 위치가 함께 바뀐다.
     주소에 ?pn=128 처럼 붙이면 파일을 고치지 않고 다른 값으로 볼 수 있다.
     137px 까지는 버튼 묶음(696px)이 본문에 들어간다. 그보다 크면 넘친다 */
  --place-name-size: 112px;
  /* 띠 = 위쪽 줄(96px) + 이름 상자 + 아래 여백(12px) */
  --band-height: calc(var(--plate-top) + var(--plate-height) + 12px);`,
  )
  // 상자 높이: 한 줄 기준으로 고정한다 (기본 크기 한 줄 높이 + 위아래 여백 52px 씩). 이름 길이에 따라 바뀌지 않는다.
  // 긴 이름은 글씨가 작아질 뿐 상자와 띠의 높이는 그대로다
  .rep('  --plate-height: 172px;', '  --plate-height: calc(var(--place-name-size) * 1.12 + 104px);')
  .rep(
    '  --font-name: 72px; /* 역명판의 이름. 문서의 --font-display 와 같은 값 */',
    '  --font-name: var(--place-name-size); /* 역명판의 이름. 긴 이름은 v8-name.js 의 fitPlaceName 이 줄인다 */\n  --place-name-min: 72px; /* 이름을 줄일 때의 최소 크기 */\n  --place-name-step: 8px; /* 한 번에 줄이는 크기 */',
  )
  // 이름은 항상 한 줄이다 (이름 상자가 white-space: nowrap). 줄바꿈도 말줄임표도 없다
  .rep('  font-size: var(--font-name);\n  font-weight: 700;\n  line-height: 80px;\n}', '  font-size: var(--font-name);\n  font-weight: 700;\n  line-height: 1.12;\n  white-space: nowrap;\n}')
  .rep('v7-', 'v8-')
writeFileSync('v8.css', css.text)

// ---------- 띠 부품: 구조와 색은 v7 그대로 ----------
writeFileSync(
  'v8-band.js',
  editor(readFileSync('v7-band.js', 'utf8'), 'v7-band.js')
    .rep('// (build-v7.mjs 가 ', '// (build-v8.mjs 가 v7-band.js 에서 다시 만든 파일. 그 전에는 build-v7.mjs 가 ')
    // 버스 번호 줄과 버스 종류 표지의 자리를 잴 수 있게 표시를 붙인다 (이름판과 겹치는지 확인용)
    .rep('<span class="v7-nums" style="top:${ys[i]}px">', '<span class="v7-nums" data-zone="nums${i}" style="top:${ys[i]}px">')
    .rep('<span class="v7-tag is-edge" style="top:${ys[i]}px">', '<span class="v7-tag is-edge" data-zone="kind${i}" style="top:${ys[i]}px">')
    // 이름판에는 이름만 넣는다. 역 번호 원과 가까운 지하철 줄은 그리지 않는다 (데이터에 있어도 지금은 표시하지 않는다)
    .rep(
      "el.querySelector('.v7-plate').innerHTML = plate",
      "el.querySelector('.v7-plate').innerHTML = place?.name && (place.lines?.length || place.buses?.length) ? `<div class=\"v7-name\">${displayPlaceName(place)}</div>` : plate\n  document.fonts.ready.then(() => fitPlaceName(el)) // 글꼴을 읽은 뒤에 너비를 잰다 (v8-name.js)",
    )
    // 띠 높이가 이름 크기를 따라 바뀌므로, 선의 높이를 고정값이 아니라 이름 상자의 자리에서 구한다
    .rep('const ROW_TOP = 124 // 첫 선의 높이', 'let ROW_TOP = 124 // 첫 선의 높이. renderBand 가 이름 상자 위쪽 끝 + 28px 로 다시 정한다')
    .rep('const ROW_BOTTOM = 248 // 마지막 선의 높이', 'let ROW_BOTTOM = 248 // 마지막 선의 높이. renderBand 가 이름 상자 아래쪽 끝 − 20px 로 다시 정한다\nlet BAND_HEIGHT = 280 // 띠 높이. renderBand 가 실제 높이로 다시 정한다')
    .rep('<svg viewBox="0 0 ${WIDTH} 280"', '<svg viewBox="0 0 ${WIDTH} ${BAND_HEIGHT}"')
    .rep(
      'function renderBand(el, place) {\n',
      "function renderBand(el, place) {\n  const box = el.querySelector('.v7-plate')\n  ROW_TOP = box.offsetTop + 28\n  ROW_BOTTOM = box.offsetTop + box.offsetHeight - 20\n  BAND_HEIGHT = el.offsetHeight\n",
    )
    .rep('v7-', 'v8-').text,
)

// ---------- 세 장 ----------
const svgOf = (name, cls = '') => {
  const svg = readFileSync(`../shared/icons/${name}.svg`, 'utf8')
  return `<svg${cls ? ` class="${cls}"` : ''} viewBox="${svg.match(/viewBox="([^"]+)"/)[1]}" aria-hidden="true">${svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg>`
}
const placeOf = (file) => readFileSync(file, 'utf8').match(/window\.PLACE = ([\s\S]*?)\n    <\/script>/)[1]

const page = (title, note, place) => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <link rel="stylesheet" href="../shared/base.css" />
    <link rel="stylesheet" href="v8.css" />
  </head>
  <body>
    <!-- (build-v8.mjs 가 만든 파일) 가로 캔버스 1920×1080. 세 파일(v8-subway / v8-bus / v8-default)은 아래 PLACE 값만 다르다 -->
    <!-- ${note} -->
    <script>
      window.PLACE = ${place}
      // 비교용: 주소에 ?ql=220 을 붙이면 질문 묶음의 왼쪽 끝(--question-left)을 그 값(px)으로 바꿔 보여 준다
      const ql = new URLSearchParams(location.search).get('ql')
      if (ql) document.documentElement.style.setProperty('--question-left', Number(ql) + 'px')
      // 비교용: 주소에 ?pn=128 을 붙이면 역·정류장 이름의 글씨 크기(--place-name-size)를 그 값(px)으로 바꿔 보여 준다
      const pn = new URLSearchParams(location.search).get('pn')
      if (pn) document.documentElement.style.setProperty('--place-name-size', Number(pn) + 'px')
      // 시험용: 주소에 ?name=아주 긴 이름 을 붙이면 그 이름으로 보여 준다 (이름 규칙이 어떻게 적용되는지 보려고)
      const testName = new URLSearchParams(location.search).get('name')
      if (testName && window.PLACE) window.PLACE.name = testName
    </script>

    <section class="screen" data-screen="IDLE">
      <!-- 역명판 띠: 지금 계신 곳 표시를 겸한다. 안쪽은 v8-band.js 가 그린다 -->
      <header class="v8-band" data-zone="band">
        <div class="v8-lines"></div>
        <div class="v8-brand">
          <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" aria-hidden="true">
            <circle cx="28" cy="28" r="20" stroke-width="9" />
            <circle cx="28" cy="28" r="5" fill="currentColor" stroke="none" />
          </svg>
          <span>말길</span>
        </div>
        <div class="v8-note"></div>
        <div class="v8-now"><span data-date>11월 16일 월요일</span> <span data-clock>오후 2:30</span></div>
        <div class="v8-plate" data-zone="plate"></div>
      </header>

      <!-- 본문 왼쪽: 질문과 예시. 왼쪽 끝은 이름판의 왼쪽 끝과 같은 세로선, 세로 가운데는 버튼 묶음과 같다 -->
      <main class="v8-left">
        <div data-zone="content">
          <h1 class="v8-question v3-core">어디로 가시나요?</h1>
          <p class="v8-say-label">이렇게 말해 보세요</p>
          <ul class="v8-says">
            <li>“명동 어떻게 가요?”</li>
            <li>“서울역 가는 버스”</li>
            <li>“가까운 병원”</li>
          </ul>
        </div>
      </main>

      <!-- 본문 오른쪽: 버튼 묶음 -->
      <div class="v8-actions" data-zone="actions">
        <button type="button" class="btn btn-primary" data-zone="primary">
          <span class="v8-mic">${svgOf('mic')}</span>
          <span>말하기</span>
        </button>
        <button type="button" class="btn btn-secondary" data-zone="secondary">${svgOf('touch_app', 'v8-hand')}손으로 고르기</button>
      </div>
    </section>

    <script src="../shared/mock.js"></script>
    <script src="../shared/v3.js"></script>
    <script src="v8-name.js"></script>
    <script src="v8-band.js"></script>
  </body>
</html>
`
writeFileSync('v8-subway.html', page('시안 v8. IDLE 가로 (지하철역: 종로3가역)', '역 번호와 노선색은 공식 자료로 확인하지 않았다', placeOf('v4-subway.html')))
writeFileSync('v8-bus.html', page('시안 v8. IDLE 가로 (버스정류장: 종로3가.탑골공원 정류장)', '버스 번호는 예시다 (example: true 이면 띠 위쪽 줄에 예시라고 표시된다)', placeOf('v4-bus.html')))
writeFileSync('v8-default.html', page('시안 v8. IDLE 가로 (장소 정보 없음)', '장소 정보가 없거나 불러오지 못했을 때의 모습', placeOf('v4-default.html')))
// 아주 긴 이름일 때 이름 규칙(v8-name.js)이 어떻게 적용되는지 보려는 예시. 정류장 이름은 지어낸 것이다
writeFileSync(
  'v8-bus-long.html',
  page('시안 v8. IDLE 가로 (버스정류장: 아주 긴 이름 예시)', '이름이 길면 글씨가 72px 까지 줄고, 그래도 넘치면 버스 번호를 줄인다. 이 정류장 이름과 버스 번호는 예시다', placeOf('v4-bus.html').replace("name: '종로3가.탑골공원 정류장'", "name: '동대문역사문화공원.국립중앙의료원 정류장'")),
)

// ---------- 찍는 스크립트와 비교 페이지도 v7 것에서 만든다 ----------
writeFileSync(
  'v8-shoot.sh',
  editor(readFileSync('v7-shoot.sh', 'utf8'), 'v7-shoot.sh')
    .rep('#   shots/v5-v6-v7.png         v5, v6, v7 지하철역 버전을 나란히 놓은 비교 (v7-compare.html)', '#   shots/v7-v8.png            v7 과 v8 을 나란히 놓은 비교 (v8-compare.html)')
    .rep('shot 1980 1210 "shots/v5-v6-v7.png" "v7-compare.html"', 'shot 1420 1210 "shots/v7-v8.png" "v8-compare.html"')
    .rep('v7', 'v8')
    .rep('#   shots/v8-v8.png            v8 과 v8 을 나란히 놓은 비교', '#   shots/v7-v8.png            v7 과 v8 을 나란히 놓은 비교')
    .rep('"shots/v8-v8.png"', '"shots/v7-v8.png"').text,
)
writeFileSync(
  'v8-compare.html',
  editor(readFileSync('v7-compare.html', 'utf8'), 'v7-compare.html')
    .rep('<title>v5, v6, v7 비교 (지하철역)</title>', '<title>v7 과 v8 비교</title>')
    .rep('<h1>v5, v6, v7 비교 (1920×1080 을 30%로 줄여 봄. 그림을 누르면 실제 크기)</h1>', '<h1>v7 과 v8 비교 (1920×1080 을 30%로 줄여 봄. 그림을 누르면 실제 크기)</h1>')
    .rep('          <th>v5</th>\n          <th>v6</th>\n          <th>v7</th>', '          <th>v7</th>\n          <th>v8</th>')
    .rep(
      `        row('지하철역', ['v5-subway', 'v6-subway', 'v7-subway']) +
        row('흐림 blur(12px)', ['v5-subway-blur', 'v6-subway-blur', 'v7-subway-blur']) +
        row('v7 다른 두 장', ['v7-bus', 'v7-default', 'v7-bus-blur'])`,
      `        row('지하철역', ['v7-subway', 'v8-subway']) +
        row('흐림 blur(12px)', ['v7-subway-blur', 'v8-subway-blur']) +
        row('v8 다른 두 장', ['v8-bus', 'v8-default'])`,
    ).text,
)
console.log('v8.css, v8-band.js, v8 세 장, v8-shoot.sh, v8-compare.html 을 만들었습니다')
