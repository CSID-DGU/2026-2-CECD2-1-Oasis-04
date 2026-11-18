// v5(가로) 파일을 v4 에서 만들어 낸다. 실행: design/mockups 에서 `node build-v5.mjs`
//   v5-diagram.js   v4-diagram.js 의 그리는 방법은 그대로 두고 크기와 좌표만 가로용으로 바꾼다
//   v5-*.html       세 장. 장소 정보(window.PLACE)는 v4-*.html 의 것을 그대로 가져온다
// v4 의 부품이나 장소 정보를 고치면 이 스크립트를 다시 돌려 v5 를 맞춘다.
import { readFileSync, writeFileSync } from 'node:fs'

// ---------- 부품 ----------
let d = readFileSync('v4-diagram.js', 'utf8')
const rep = (from, to) => {
  if (!d.includes(from)) throw new Error('v4-diagram.js 에서 찾지 못함: ' + from.slice(0, 50))
  d = d.split(from).join(to)
}
rep(
  '// 노선 그림 부품 (시안). 장소 정보(window.PLACE)를 받아 .v4-diagram 안에 그림을 그린다.',
  '// (build-v5.mjs 가 v4-diagram.js 에서 만든 파일. 직접 고치지 않는다)\n// 노선 그림 부품 (시안, 가로 캔버스용). 장소 정보(window.PLACE)를 받아 .v5-diagram 안에 그림을 그린다.\n// v4 와 그리는 방법은 같고 크기만 다르다: 왼쪽 칸 너비 1160, 높이 340.',
)
rep('const W = 984 // 그림 너비 (1080 − 여백 48 × 2)', 'const W = 1160 // 그림 너비 (왼쪽 칸)')
rep('const H = 400 // 그림 높이', 'const H = 340 // 그림 높이')
// 지하철역: 가로로 펼친다. 노선이 4개여도 높이 340 에 들어가게 간격을 줄인다
rep('  const hubX = 372', '  const hubX = 470\n  const gap = Math.min(118, (H - 68) / Math.max(1, lines.length - 1))')
rep('    y: H / 2 + (i - mid) * 118, // 양 끝에서의 높이', '    y: H / 2 + (i - mid) * gap, // 양 끝에서의 높이')
rep('    hubY: H / 2 + (i - mid) * 80, // 갈아타는 역에서의 높이 (가운데로 모인다)', '    hubY: H / 2 + (i - mid) * gap * 0.68, // 갈아타는 역에서의 높이 (가운데로 모인다)')
rep('M76 ${y}H${226}L${226 + d} ${hubY}H${500}L${500 + d} ${y}H596', 'M76 ${y}H${290}L${290 + d} ${hubY}H${640}L${640 + d} ${y}H780')
rep("html += text(624, y, `${line.prev} ↔ ${line.next}`, 'is-left')", "html += text(812, y, `${line.prev} ↔ ${line.next}`, 'is-left')")
// 버스정류장: 줄 영역과 가까운 지하철 줄의 높이
rep('  const rowsHeight = 300', '  const rowsHeight = 256')
rep('  const step = Math.min(100, rowsHeight / groups.length)', '  const step = Math.min(88, rowsHeight / groups.length)')
rep('    const y = 352\n', '    const y = 304\n')
rep('style="right:0;top:352px"', 'style="right:0;top:304px"')
// 기본 그림
rep('  const ys = [82, 200, 318]\n  const hub = [120, 200, 280]', '  const ys = [52, 170, 288]\n  const hub = [90, 170, 250]')
rep('M0 ${y}H${226}L${226 + d} ${hub[i]}H${640}L${640 + d} ${y}H${W}', 'M0 ${y}H${290}L${290 + d} ${hub[i]}H${760}L${760 + d} ${y}H${W}')
rep('<rect x="316" y="80" width="112" height="240" rx="40"', '<rect x="414" y="50" width="112" height="240" rx="40"')
rep('<circle cx="372" cy="${y}" r="14"', '<circle cx="470" cy="${y}" r="14"')
rep('    [110, 82],\n    [840, 82],\n    [110, 200],\n    [760, 200],\n    [110, 318],\n    [880, 318],', '    [130, 52],\n    [1000, 52],\n    [130, 170],\n    [900, 170],\n    [130, 288],\n    [1040, 288],')
rep('.v4-diagram', '.v5-diagram')
rep('.v4-place', '.v5-place')
writeFileSync('v5-diagram.js', d)

// ---------- 세 장 ----------
const mic = readFileSync('../shared/icons/mic.svg', 'utf8')
const ico = `<svg class="v5-ico" viewBox="${mic.match(/viewBox="([^"]+)"/)[1]}" aria-hidden="true">${mic.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg>`
const placeOf = (file) => readFileSync(file, 'utf8').match(/window\.PLACE = ([\s\S]*?)\n    <\/script>/)[1]

const page = (title, note, place) => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <link rel="stylesheet" href="../shared/base.css" />
    <link rel="stylesheet" href="v5.css" />
  </head>
  <body>
    <!-- (build-v5.mjs 가 만든 파일) 가로 캔버스 1920×1080. 세 파일(v5-subway / v5-bus / v5-default)은 아래 PLACE 값만 다르다 -->
    <!-- ${note} -->
    <script>
      window.PLACE = ${place}
    </script>

    <section class="screen" data-screen="IDLE">
      <div class="v5-abs v5-rail"></div>

      <div class="v5-abs v5-brand">
        <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" aria-hidden="true">
          <circle cx="28" cy="28" r="20" stroke-width="9" />
          <circle cx="28" cy="28" r="5" fill="currentColor" stroke="none" />
        </svg>
        <span>말길</span>
      </div>
      <div class="v5-abs v5-now"><span data-date>11월 16일 월요일</span> <span data-clock>오후 2:30</span></div>

      <div class="v5-abs v5-place"></div>
      <div class="v5-abs v5-diagram"></div>

      <h1 class="v5-abs v5-question v3-core">어디로 가시나요?</h1>
      <div class="v5-abs v5-say">
        <span class="v5-say-label">이렇게 말해 보세요</span>
        <span class="v5-say-words" data-rotate="명동 어떻게 가요?|서울역 가는 버스|가까운 병원|동대문시장 가는 길"></span>
      </div>

      <div class="v5-abs v5-actions">
        <button type="button" class="btn btn-primary">${ico}말하기</button>
        <button type="button" class="btn btn-secondary">손으로 고르기</button>
      </div>
    </section>

    <script>
      // 제안 보기: 주소에 ?rail=1 을 붙이면 오른쪽 칸이 옅은 판으로 보인다 (v5.css 의 .v5-rail)
      if (new URLSearchParams(location.search).has('rail')) document.body.classList.add('has-rail')
    </script>
    <script src="../shared/mock.js"></script>
    <script src="../shared/v3.js"></script>
    <script src="v5-diagram.js"></script>
  </body>
</html>
`
writeFileSync('v5-subway.html', page('시안 v5. IDLE 가로 (지하철역: 종로3가역)', '역 번호와 노선색은 공식 자료로 확인하지 않았다', placeOf('v4-subway.html')))
writeFileSync('v5-bus.html', page('시안 v5. IDLE 가로 (버스정류장: 종로3가.탑골공원 정류장)', '버스 번호는 예시다 (example: true 이면 그림에 예시라고 표시된다)', placeOf('v4-bus.html')))
writeFileSync('v5-default.html', page('시안 v5. IDLE 가로 (장소 정보 없음: 기본 그림)', '장소 정보가 없거나 불러오지 못했을 때의 모습', placeOf('v4-default.html')))
console.log('v5-diagram.js 와 v5 세 장을 만들었습니다')
