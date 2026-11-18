// 시험용 페이지를 v8 에서 만든다. 실행: design/mockups 에서 `node build-v9.mjs`
//   v8-test.html   지금 시안(v8) 그대로. 장소 정보만 v9-cases.js 에서 고른다 (?case=seoul). 어디가 깨지는지 보는 용도
//   v9-test.html   같은 화면에 띠 규칙(v9-band.js, v9-extra.css)을 적용한 것. 전후 비교용
//   v9-reduced.html  IDLE_REDUCED: 음성을 쓸 수 없을 때. '손으로 고르기'가 주 버튼
import { readFileSync, writeFileSync } from 'node:fs'

const base = readFileSync('v8-subway.html', 'utf8')
const cut = (text, from, to) => {
  const a = text.indexOf(from)
  const b = text.indexOf(to, a)
  if (a < 0 || b < 0) throw new Error('찾지 못함: ' + from.slice(0, 40))
  return [text.slice(0, a), text.slice(a, b + to.length), text.slice(b + to.length)]
}

// 장소 정보를 ?case= 로 고르게 바꾼다
const [head, , tail] = cut(base, '      window.PLACE = {', '      }\n')
const withCases = (title) =>
  (head + "      window.PLACE = window.V8_CASES[new URLSearchParams(location.search).get('case') ?? 'jongno3ga'] ?? null\n" + tail)
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace('    <script>\n      window.PLACE', '    <script src="v9-cases.js"></script>\n    <script>\n      window.PLACE')
    .replace(/<!-- \(build-v8\.mjs 가 만든 파일\)[^\n]*\n\s*<!--[^\n]*\n/, '    <!-- (build-v9.mjs 가 v8-subway.html 에서 만든 파일) 띠 시험용. 주소에 ?case=seoul 처럼 붙인다 (v9-cases.js) -->\n')

writeFileSync('v8-test.html', withCases('시안 v8 그대로 + 시험 데이터'))

const v9 = withCases('시안 v9. 띠 규칙 적용 + 시험 데이터')
  .replace('    <link rel="stylesheet" href="v8.css" />', '    <link rel="stylesheet" href="v8.css" />\n    <link rel="stylesheet" href="v9-extra.css" />')
  .replace('    <script src="v8-band.js"></script>', '    <script src="v9-band.js"></script>')
  .replace("      const testName = ", "      // 주소에 ?soft=1 을 붙이면 노선 선을 예전의 옅은 색으로 보여 준다 (v9-extra.css. 기본은 진한 선)\n      if (new URLSearchParams(location.search).has('soft')) document.documentElement.classList.add('is-soft-lines')\n      const testName = ")
if (!v9.includes('v9-band.js') || !v9.includes('v9-extra.css') || !v9.includes('is-soft-lines')) throw new Error('v9 로 바꾸지 못한 곳이 있다')
writeFileSync('v9-test.html', v9)

// IDLE_REDUCED: 질문 + 안내, 주 버튼은 '손으로 고르기' 하나. 마이크 관련 표시는 없다
const hand = readFileSync('../shared/icons/touch_app.svg', 'utf8')
const handSvg = `<svg viewBox="${hand.match(/viewBox="([^"]+)"/)[1]}" aria-hidden="true">${hand.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg>`
let reduced = v9.replace(/<title>[^<]*<\/title>/, '<title>시안 v9. IDLE_REDUCED (음성을 쓸 수 없을 때)</title>').replace('data-screen="IDLE"', 'data-screen="IDLE_REDUCED"')
{
  const [a, , c] = cut(reduced, '          <p class="v8-say-label">', '          </ul>\n')
  reduced = a + '          <!-- 문구는 frontend/src/screens/IdleReducedScreen.jsx 의 것 그대로다 -->\n          <p class="v9-notice">지금은 음성 안내를 쓸 수 없어요.<br />손으로 골라 주세요</p>\n' + c
}
{
  const [a, , c] = cut(reduced, '        <button type="button" class="btn btn-primary" data-zone="primary">', '손으로 고르기</button>\n')
  reduced = a + `        <button type="button" class="btn btn-primary" data-zone="primary">\n          <span class="v9-hand-big">${handSvg}</span>\n          <span>손으로 고르기</span>\n        </button>\n` + c
}
writeFileSync('v9-reduced.html', reduced.replace('?s=IDLE', '?s=IDLE_REDUCED'))
console.log('v8-test.html, v9-test.html, v9-reduced.html 을 만들었습니다')
