// 확정 시안 파일을 v8·v10 에서 모아 만든다 (모양은 v8, 띠 규칙은 v10). 실행: design/mockups/archive 에서 `node build-final.mjs`. 결과는 ../confirmed/ 에 쓴다
//   idle-final.css             v8.css + v10-extra.css 를 한 파일로
//   idle-band.js               띠 부품 (v8-name.js 의 displayPlaceName + v10-band.js)
//   idle-final-subway.html     IDLE, 지하철역 (종로3가역)
//   idle-final-bus.html        IDLE, 버스정류장 (종로3가.탑골공원 정류장. 버스 번호는 예시)
//   idle-final-default.html    IDLE, 장소 정보 없음
//   idle-reduced-final.html    IDLE_REDUCED (음성을 쓸 수 없을 때)
//   band-thin.html             얇은 띠 (IDLE 이 아닌 화면용). MANUAL_SELECT 예시
// 클래스 이름은 만들던 때의 v8-, v9- 가 그대로 남아 있다. 실제 앱으로 옮길 때 이름을 다시 짓는다.
import { readFileSync, writeFileSync } from 'node:fs'

// 서비스 이름: 원본(v8~v10)에 적힌 이름을 이름 자리로 바꾸고 ../shared/brand.js 를 불러온다. 이름은 brand.js 한 곳에서 정한다
const brand = (html, source) => {
  for (const [from, to] of [
    ['<span>말길</span>', '<service-name></service-name>'],
    ['  </head>', '    <script src="../shared/brand.js"></script>\n  </head>'],
  ]) {
    if (html.split(from).length - 1 !== 1) throw new Error(`${source}: 한 번만 있어야 함: ${from}`)
    html = html.replace(from, to)
  }
  return html
}

const note = (from) => `/* (build-final.mjs 가 ${from} 에서 모은 파일. 직접 고치지 않는다) */\n`
writeFileSync('../confirmed/idle-final.css', note('v8.css, v10-extra.css') + readFileSync('v8.css', 'utf8') + '\n/* ================= v10-extra.css ================= */\n\n' + readFileSync('v10-extra.css', 'utf8'))

const nameJs = readFileSync('v8-name.js', 'utf8')
const displayFn = nameJs.slice(nameJs.indexOf('/** 화면에 보일 이름.'), nameJs.indexOf('/**\n * 띠(.v8-band) 하나를'))
if (!displayFn.includes('function displayPlaceName')) throw new Error('displayPlaceName 을 찾지 못함')
writeFileSync('../confirmed/idle-band.js', `// (build-final.mjs 가 v8-name.js, v10-band.js 에서 모은 파일. 직접 고치지 않는다)\n\n${displayFn}\n${readFileSync('v10-band.js', 'utf8')}`)

// 장소 정보: 시험 데이터(v9-cases.js)에서 가져온다
const window = {}
new Function('window', readFileSync('v9-cases.js', 'utf8'))(window)
const placeText = (key) => (key ? JSON.stringify(window.V8_CASES[key], null, 2).replace(/\n/g, '\n      ') : 'null')

function finalize(source, title, key) {
  let html = readFileSync(source, 'utf8')
  const swap = (from, to) => {
    if (!html.includes(from)) throw new Error(`${source}: 찾지 못함: ${from.slice(0, 50)}`)
    html = html.split(from).join(to)
  }
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  swap('    <link rel="stylesheet" href="v8.css" />\n    <link rel="stylesheet" href="v10-extra.css" />', '    <link rel="stylesheet" href="idle-final.css" />')
  swap('    <script src="v9-cases.js"></script>\n', '')
  swap("window.V8_CASES[new URLSearchParams(location.search).get('case') ?? 'jongno3ga'] ?? null", placeText(key))
  swap('    <script src="v8-name.js"></script>\n    <script src="v10-band.js"></script>', '    <script src="idle-band.js"></script>')
  html = html.replace(/    <!-- \(build-v10.mjs 가[^\n]*\n/, '    <!-- (build-final.mjs 가 만든 파일) 확정 시안. 가로 캔버스 1920×1080 -->\n')
  return brand(html, source)
}

writeFileSync('../confirmed/idle-final-subway.html', finalize('v10-test.html', 'IDLE 확정 시안 (지하철역: 종로3가역)', 'jongno3ga'))
writeFileSync('../confirmed/idle-final-bus.html', finalize('v10-test.html', 'IDLE 확정 시안 (버스정류장: 종로3가.탑골공원 정류장)', 'bus'))
writeFileSync('../confirmed/idle-final-default.html', finalize('v10-test.html', 'IDLE 확정 시안 (장소 정보 없음)', null))
writeFileSync('../confirmed/idle-reduced-final.html', finalize('v10-reduced.html', 'IDLE_REDUCED 확정 시안 (음성을 쓸 수 없을 때)', 'jongno3ga'))
writeFileSync('../confirmed/band-thin.html', brand(readFileSync('v9-thin.html', 'utf8'), 'v9-thin.html').replace(/<title>[^<]*<\/title>/, '<title>얇은 띠 확정 시안 (IDLE 이 아닌 화면용) — MANUAL_SELECT 예시</title>'))
console.log('idle-final.css, idle-band.js, idle-final-*.html, idle-reduced-final.html, band-thin.html 을 만들었습니다')
