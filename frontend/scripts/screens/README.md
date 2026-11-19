# 화면 찍기·비교 스크립트

계획서(`docs/design-implementation-plan.md`) 6-A절의 확인(시안과 같은지, 바뀐 곳이 없는지, 하한선)을 단계마다 같은 방법으로 하려고 둔다.
2단계부터 모든 단계의 화면 비교는 이 스크립트로 한다. (1단계 때는 `.playwright-mcp/step1/` 에 있던 것을 옮겨 왔다)

| 파일 | 하는 일 |
|---|---|
| `shoot-screens.js` | 실제 앱 14화면을 1920×1080 으로 찍고, 화면마다 하한선 숫자를 돌려준다. 흐림(12px) 그림도 고른 화면만 찍는다 |
| `shoot-pick.js` | CONFIRMING·MANUAL_SELECT 의 9가지 경우를 앱과 확정 시안에서 나란히 찍는다 (5단계에서 생김). 비교는 `compare-shots.js` 의 `a`·`b` 를 `mock-step5`·`current-step5` 로 |
| `compare-shots.js` | 그림 폴더 두 개를 같은 이름끼리 픽셀로 비교한다 (다른 픽셀 수와 다른 곳의 상자) |
| `serve-repo.mjs` | 저장소 전체를 `http://127.0.0.1:8800/` 으로 보여 주는 작은 서버. 비교와 확정 시안 찍기에 쓴다 |

`shoot-screens.js`·`compare-shots.js` 는 Node 로 바로 돌리는 파일이 아니라 **Playwright 가 `page` 를 넘겨 부르는 함수 하나**다.
이 저장소에는 Playwright 를 의존성으로 넣지 않았으므로 Claude Code 의 Playwright MCP(`browser_run_code`)로 돌린다.

## 준비 (터미널 두 개)

```bash
cd frontend
npm run dev                              # 1) 개발 서버 http://localhost:5173 (mock 모드)
node scripts/screens/serve-repo.mjs      # 2) 비교할 때만. 저장소를 http://127.0.0.1:8800 으로
```

## 14화면 찍기

Claude Code 에게 "`frontend/scripts/screens/shoot-screens.js` 를 browser_run_code 의 filename 으로 돌려 줘" 라고 하면 된다.

- 그림은 `OPTIONS.out`(기본 `.playwright-mcp/shots/current/`, git 이 무시하는 폴더)에 `01-STARTUP_CHECK.png` ~ `14-UNAVAILABLE.png` 로 저장된다
- 시계를 2026-11-19 오후 2:30 에 멈추고 찍는다. 띠의 시각과 움직이는 부분(음량 막대 등)이 그림마다 같아서 픽셀 비교를 할 수 있다
- DevPanel 의 이벤트 단추를 눌러 상태를 지나가므로, DevPanel 단추 글자 모양("EVENT → NEXT")을 바꾸면 이 스크립트도 고친다
- 돌려주는 숫자: `minFont`(가장 작은 글씨), `small`(30px 미만 글씨 수), `btns`·`lowBtn`(버튼 수·112px 미만 버튼 수), `primary`(주 버튼 수), `bad`(허용 조합 밖의 글씨|배경), `scroll`(스크롤이 생긴 요소 수)
- `OPTIONS.stopArcs`(기본 true): 도는 호를 12시 자리에 멈추고 찍는다. 가짜 시계는 CSS 움직임을 멈추지 않으므로, 시안은 `?freeze=0` 으로 찍어 비교한다
- `OPTIONS.reasons`: UNAVAILABLE 을 이유별로 더 찍는다(`14-UNAVAILABLE-noroute.png` 등). DevPanel 의 '오류 이유' 를 골라 `ROUTE_FAILED` 로 들어간다. 시안은 `unavailable-final.html?r=<이유>`
- `OPTIONS.extras`(기본 true): 들은 말이 빈 RESOLVING·REASKING(`06-RESOLVING-empty`, `09-REASKING-empty`)도 찍는다. 시안은 `?heard=`
- `OPTIONS.blur` 에 화면 번호를 넣으면 `-blur.png` 도 찍는다 (시선 순서 검사, 디자인 문서 3-9절). `OPTIONS.only` 로 저장할 화면만 고를 수 있다

## 바뀐 곳이 없는지 비교

1. 작업 **전에** 한 번 찍어서 폴더 이름을 바꿔 둔다 (예: `.playwright-mcp/shots/base-step2`)
2. 작업 뒤에 다시 찍는다 (`current/`)
3. `compare-shots.js` 의 `OPTIONS.a`·`b` 를 두 폴더로 맞추고 돌린다. 옮기지 않은 화면은 `0px` 이어야 한다
4. `OPTIONS.diffOut` 에 폴더를 주면 다른 픽셀을 빨갛게 칠한 그림도 남긴다

## 확정 시안과 비교

시안도 같은 시각으로 멈추고 같은 크기로 찍는다. 예 (browser_run_code 에 직접):

```js
async (page) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  const T0 = new Date('2026-11-19T14:30:00').getTime()
  await page.clock.install({ time: T0 }); await page.clock.pauseAt(T0 + 10)
  await page.goto('http://127.0.0.1:8800/design/mockups/confirmed/listening-final.html?freeze=0.6')
  await page.evaluate(() => document.fonts.ready)
  await page.locator('section.screen').screenshot({ path: '<저장소>/.playwright-mcp/shots/mock/05-LISTENING.png' })
}
```

그 뒤 `compare-shots.js` 의 `a` 를 시안 그림 폴더, `names` 를 그 화면으로 바꿔 돌린다. 시안과 앱의 데이터가 다른 곳(예: 띠의 장소 이름)은 차이로 나온다.

## 주의

- 가짜 시계(`page.clock`)는 같은 탭에 남는다. 찍은 뒤 같은 탭에서 타이머 흐름을 손으로 시험하면 시간이 흐르지 않는다. 새 탭(새 context)에서 시험한다
- 창이 1920×1080 이면 DevPanel 이 오른쪽 아래 버튼을 덮는다. 손으로 누를 때는 Ctrl+Shift+D 로 패널을 끄거나 창을 키운다 (찍을 때는 스크립트가 패널을 숨긴다)
