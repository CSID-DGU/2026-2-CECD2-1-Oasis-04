// v6 세 장을 만든다. 실행: design/mockups 에서 `node build-v6.mjs`
// 세 파일은 장소 정보(window.PLACE)만 다르다. 장소 정보는 v4-*.html 의 것을 그대로 가져온다.
import { readFileSync, writeFileSync } from 'node:fs'

const mic = readFileSync('../shared/icons/mic.svg', 'utf8')
const micSvg = `<svg viewBox="${mic.match(/viewBox="([^"]+)"/)[1]}" aria-hidden="true">${mic.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg>`
const placeOf = (file) => readFileSync(file, 'utf8').match(/window\.PLACE = ([\s\S]*?)\n    <\/script>/)[1]

const page = (title, note, place) => `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <link rel="stylesheet" href="../shared/base.css" />
    <link rel="stylesheet" href="v6.css" />
  </head>
  <body>
    <!-- (build-v6.mjs 가 만든 파일) 가로 캔버스 1920×1080. 세 파일(v6-subway / v6-bus / v6-default)은 아래 PLACE 값만 다르다 -->
    <!-- ${note} -->
    <script>
      window.PLACE = ${place}
    </script>

    <section class="screen" data-screen="IDLE">
      <!-- A. 역명판 띠: 지금 계신 곳 표시를 겸한다. 안쪽은 v6-band.js 가 그린다 -->
      <header class="v6-band">
        <div class="v6-lines"></div>
        <div class="v6-brand">
          <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" aria-hidden="true">
            <circle cx="28" cy="28" r="20" stroke-width="9" />
            <circle cx="28" cy="28" r="5" fill="currentColor" stroke="none" />
          </svg>
          <span>말길</span>
        </div>
        <div class="v6-note"></div>
        <div class="v6-now"><span data-date>11월 16일 월요일</span> <span data-clock>오후 2:30</span></div>
        <div class="v6-plate"></div>
      </header>

      <!-- C. 왼쪽 내용 칸: 질문과 예시. 주 버튼과 세로 가운데를 맞춘다 -->
      <main class="v6-content">
        <h1 class="v6-question v3-core">어디로 가시나요?</h1>
        <div class="v6-say">
          <span class="v6-say-label">이렇게 말해 보세요</span>
          <span class="v6-say-words" data-rotate="명동 어떻게 가요?|서울역 가는 버스|가까운 병원|동대문시장 가는 길"></span>
        </div>
      </main>

      <!-- B. 오른쪽 행동 판 -->
      <div class="v6-rail">
        <button type="button" class="btn btn-primary">
          <span class="v6-mic">${micSvg}</span>
          <span>말하기</span>
        </button>
        <button type="button" class="btn btn-secondary">손으로 고르기</button>
      </div>
    </section>

    <script src="../shared/mock.js"></script>
    <script src="../shared/v3.js"></script>
    <script src="v6-band.js"></script>
  </body>
</html>
`
writeFileSync('v6-subway.html', page('시안 v6. IDLE 가로 (지하철역: 종로3가역)', '역 번호와 노선색은 공식 자료로 확인하지 않았다', placeOf('v4-subway.html')))
writeFileSync('v6-bus.html', page('시안 v6. IDLE 가로 (버스정류장: 종로3가.탑골공원 정류장)', '버스 번호는 예시다 (example: true 이면 띠 위쪽 줄에 예시라고 표시된다)', placeOf('v4-bus.html')))
writeFileSync('v6-default.html', page('시안 v6. IDLE 가로 (장소 정보 없음)', '장소 정보가 없거나 불러오지 못했을 때의 모습', placeOf('v4-default.html')))
console.log('v6 세 장을 만들었습니다')
