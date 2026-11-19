# 확정 시안을 실제 앱에 옮기는 계획

- 작성일: 2026-11-19
- 목적: `design/mockups/confirmed/` 의 확정 시안 14개 상태를 `frontend/` 에 옮긴다. 이 문서만 읽고 다음 세션이 작업을 시작할 수 있게 쓴다
- 값(px, 색, 문구)은 이 문서에 다시 적지 않는다. 디자인 문서(`docs/design-guidelines.md`) 절 번호와 시안 파일 이름으로 가리킨다. 값이 다르면 디자인 문서가 이긴다

## 0. 목적과 범위

### 0-1. 기준 문서와 우선순위

| 순서 | 문서 | 이 작업에서 보는 것 |
|---|---|---|
| 1 | `docs/design-guidelines.md` | 하한선(2절), 토큰(3절), 결정 필요(4절), 배치(6절), 화면별 규칙(7~12절) |
| 2 | `design/mockups/confirmed/*.html`, `*.css`, `*.js` | 문서에 없는 세부 모양. 문서와 다르면 문서가 기준이다 |
| 3 | `design/consistency-audit.md` | 화면끼리 같은 값인지 잰 기록. "결정과 결과" 절까지 반영된 시안이 지금의 확정본이다 |
| 4 | `docs/kiosk-workflow.md` | 상태·전이. 이 작업으로 바꾸지 않는다 (예외: 3절 10단계의 payload) |
| 5 | `docs/frontend-plan.md` | 폴더 구조, reducer 모양, 핸들러 규칙 |

### 0-2. 하지 않는 것

- 상태·전이·이벤트 추가. 버튼 종류·개수·dispatch 이벤트 변경 (CLAUDE.md '상태·전이 규칙')
- 반응형. 무대(`components/Stage.jsx`)는 그대로 쓴다
- 시안에만 있는 것: `ROUTE_GUIDE` 의 "예시" 안내 줄(9-1절), 시안 주소 값(`?left=`, `?freeze=`, `?case=`), `shared/mock.js` 의 화면 고르기
- `line_alternatives`(같은 구간의 다른 버스) 표시 (6-1절 #11)

### 0-3. 팀원 확인을 기다리지 않는다 (2026-11-19 팀장 결정)

- 팀원에게 받아야 할 것(데이터, 결정, 공유)이 있어도 기다리지 않고 mock 이나 대체 동작으로 먼저 구현한다
- 요청하거나 알려야 할 것은 `docs/team-requests.md` 에 쌓는다 (누구에게 / 무엇을 / 왜 / 지금은 어떻게 대신하나 / 생긴 단계)
- 10~13단계가 끝나면 그 파일을 정리해 팀에 한 번에 보낸다. 그 전에는 보내지 않는다

### 0-4. 브랜치

- 작업은 `feature/kiosk-design` 에서 한다. 단계마다 커밋하고 push 한다
- `main` 에 합치는 것은 10단계(모든 화면을 옮김)가 끝난 뒤다

## 1. 현재 상태 (2026-11-19, 커밋 `f92b454`)

### 1-1. 앱 구조

| 구분 | 위치 | 지금 |
|---|---|---|
| 화면 14개 | `frontend/src/screens/*.jsx`, `screens/index.js` | 상태 하나 = 화면 하나. 제목 `titles.js`, UNAVAILABLE 문구 `errorMessage.js` |
| 틀 | `components/ScreenFrame.jsx` | 제목 → 본문 → 버튼 영역을 세로로 쌓는다. '처음으로'는 `showHome` 으로 여기서만 그린다 |
| 무대 | `components/Stage.jsx` | 1920×1080 을 창에 맞춰 줄인다. 바꾸지 않는다 |
| 위치 | `components/CurrentLocation.jsx` | IDLE·IDLE_REDUCED 가 열릴 때 `api.getLocation()` 을 불러 한 줄로 보인다. 결과를 저장하지 않는다 |
| 개발자 패널 | `components/DevPanel.jsx`, `DevPanelToggle.jsx` | 무대 밖. 시나리오 선택, 가짜 payload |
| 스타일 | `styles/global.css` 하나 | 토큰 + 세로 틀(`.screen`, `.screen-actions`) + `.btn-*`, `.btn-list`, `.hint`, `.route-best`, `.qr-url` |
| 상태 | `state/` | reducer 필드는 `frontend-plan.md` 2-3절, 전이 40, 이벤트 26 |
| 부수효과 | `effects/handlers/` | 무입력 타이머(`inactivity.js`)는 남은 시간을 밖에 알리지 않는다 |
| API | `api/mock/`, `api/real/` | mock 경로는 `summary` 문자열, mock 위치는 이름·문장뿐, mock 목적지 10개(경로 없음 시험용 '외딴섬 선착장' 포함). real 경로는 `steps[]`(mode, line, busType, stops, board, alight, easyText) |
| 장치 | `devices/` | real 녹음기는 음량(analyser)을 읽지만 화면에 넘기지 않는다 |
| 테스트 | 각 폴더 `__tests__/` | 화면을 그리는 테스트는 `screens/__tests__/ManualSelectScreen.test.jsx` 하나 |
| 모드 | `.env.development`, `.env.production`, `.env.real` | `npm run dev`(mock, 타이머 단축), `npm run dev:real` |

### 1-2. 화면별로 바뀌는 것

| 화면 | 바뀌는 것 | 기준 |
|---|---|---|
| 공통 (조작 화면 7개) | 세로 틀 → 얇은 띠 + 좌우 두 칸. 버튼에 아이콘, 주 버튼·보조 버튼 모양 | 6절, 8-1절, 3-4절 시안 값 표, `shared/flow.css` |
| IDLE, IDLE_REDUCED | 큰 띠(역명판), 버튼 칸 740px, 질문·예시 | 7절, 8절, `idle-final-*.html`, `idle-reduced-final.html` |
| 기다림 5개 | 화면 가운데 고리 + 큰 글씨, 도는 호. CHECKING 은 남은 초 | 10-2·10-3절, `wait-final.html` |
| LISTENING | 듣는 중 표시(고리 + 음량 막대), 제목 없음, mock 입력창 없음 | 10-1절, `listening-final.html` |
| CONFIRMING | 고르는 카드 1열, 후보 1개면 왼쪽 칸 '예' | 11-1·11-2절, `confirming-final.html` |
| REASKING | 옅은 고리 + 핵심 줄 + 들은 말 + 예시 한 줄 | 12-1·12-2절, `reasking-final.html` |
| UNAVAILABLE | 본문색 고리, 이유별 그림, 첫 문장 오류 색 | 12-1·12-3절, `unavailable-final.html` |
| MANUAL_SELECT | 고르는 카드 3열 4줄, 불러오는 중·오류 | 6절, 11-1·11-3절, 12-4절, `manual-select-final.html` |
| ROUTE_GUIDE | 타임라인 + 경로 카드(고르기) / 경로 1개면 요약 판 | 3-6절, 9절, `route-guide-final.html`, `route-cases.js` |
| QR_HANDOFF | QR 그림 + 단계 세 줄 + 요약 판 | 12-5절, `qr-handoff-final.html` |
| 무입력 화면 6개 | 남은 시간 알림 | 11-4절, `pick.css`, `timeout-notice.js` |

## 2. 부품 목록

- 파일 위치: 부품은 `frontend/src/components/`, 부품 CSS는 같은 이름의 `.css` 를 부품 옆에 둔다(예: `components/ThinBand.jsx` + `components/ThinBand.css`). 순수 로직은 `frontend/src/view/`(새 폴더), 훅은 `frontend/src/hooks/`(새 폴더)
- 화면 파일(JSX)에는 숫자와 색을 쓰지 않는다 (2-A절)
- "지금 비슷한 것"이 있으면 그 파일을 고치거나 대체한다. 대체된 파일은 13단계에서 지운다

### 2-1. 틀

| 부품 | 쓰는 화면 | 기준 시안·CSS | 지금 비슷한 것 | props |
|---|---|---|---|---|
| `FlowFrame` | 조작 화면 7개 | `shared/flow.css` `.body .left .right`, 6절 | `ScreenFrame` | `left`(왼쪽 칸 내용), `actions`(오른쪽 칸 버튼), `showHome`, `rightTop`(경로 카드처럼 칸 위에 붙는 것, 9-1 R3) |
| `ThinBand` | IDLE·IDLE_REDUCED 를 뺀 12개 | `shared/flow.css` `.thin`, 8-1절, `consistency-audit.md` 1절 | 없음 | `secondsLeft`(null 이면 시각, 숫자면 알림). 장소 이름은 `LocationContext` 에서 읽는다 |
| `Clock` | `ThinBand`, `PlaceBand` | `shared/v3.js` 의 `tick` | 없음 | 없음 |
| `TimeoutNotice` | 무입력 화면 6개 (띠 안) | `pick.css` `.thin-alert`, `timeout-notice.js`, 11-4절 | 없음 | `secondsLeft` |
| `PlaceBand` | IDLE, IDLE_REDUCED | `idle-final.css`(`.v8-*`, `.v9-*`), `idle-band.js`, 7절, 8-3·8-4절 | `CurrentLocation` | `place`(8-5절 형식) 또는 null |
| `WaitFrame` | 기다림 5개 | `wait.css`, `wait-final.html`, 10-2·10-3절 | 없음 | `icon`, `label`(머리말, 없으면 null), `core`(큰 글씨), `sub`(안내 줄), `countdown`(CHECKING 만) |

### 2-2. 공통 부품

| 부품 | 쓰는 화면 | 기준 시안·CSS | 지금 비슷한 것 | props |
|---|---|---|---|---|
| `PrimaryButton` | 주 버튼이 있는 화면, CONFIRMING '예' | `flow.css` `.right .btn-primary`, `confirming-final.html` `.yes`, 3-4절 | `.btn-primary` 클래스 | `icon`, `onClick`, `children` |
| `SecondaryButton` | 보조 버튼 전부 | `flow.css` `.right .btn-secondary` | `.btn-secondary` 클래스 | `icon`, `onClick`, `children` |
| `HomeButton` | 조작 화면 7개 | 위와 같음 + 집 아이콘, `consistency-audit.md` 5절 | `ScreenFrame` 안의 버튼 | 없음 (GO_HOME 을 dispatch) |
| `IdleButtons` | IDLE, IDLE_REDUCED | `idle-final.css` `.v8-actions`, `.v8-mic`, `.v9-hand-big`, 8-2절 | 없음 | `voice`(마이크 주 버튼을 보일지) |
| `Icon` | 전부 | `design/mockups/shared/icons/*.svg`, 3-7절 | 없음 | `name`, `className` |
| `RingIcon` (고리 안 손 그림) | 기다림, UNAVAILABLE | `wait-final.html`·`unavailable-final.html` 의 `<template id="icon-*">`, 10-3절, 12-3절 | 없음 | `name`(flag, bubble, logo, walk, pin) |
| `Ring` | LISTENING, REASKING, UNAVAILABLE, 기다림 5개 | `flow.css` `.ring-*`, `states.css` `.ring-big`, `wait.css` `.ring-arc`·`.ring-count`, 3-4·3-5절 | 없음 | `tone`(primary / soft / text), `icon`, `arc`(none / spin / countdown), `progress`, `children` |
| `SmallRing` | MANUAL_SELECT 불러오는 중 | `states.css` `.ring-small`, 12-4절 | 없음 | 없음 |
| `VoiceMeter` | LISTENING | `listening-final.html` 의 `<style>` 과 막대 스크립트, 3-5절 | 없음 | `level`(0~1, 없으면 멈춘 모양) |
| `RingStack` | REASKING, UNAVAILABLE | `states.css` `.stack`, `.stack-title`, `.core-line`, `.core-more`, 12-1절 | 없음 | `ring`(Ring props), `title`, `core`, `coreError`, `children` |
| `HeardLine` | CONFIRMING, REASKING | `states.css` `.heard`, 11-2절 | 각 화면의 `<p>들은 말</p>` | `text` (비면 아무것도 그리지 않는다) |
| `SayExamples` | IDLE(세 줄), REASKING(한 줄) | `idle-final.css` `.v8-say-label`·`.v8-says`, `states.css` `.say-label`·`.says`, 8-2절, 12-2절 | 없음 | `examples` |
| `PickList` / `PickCard` | CONFIRMING(1열), MANUAL_SELECT(3열) | `pick.css`, 각 화면의 `<style>`, 11-1절, 6절 줄 바꿈 규칙 | `.btn-list` + `.btn-primary` | List: `variant`(confirm / select). Card: `name`, `kind`, `onClick` |

### 2-3. 경로 부품

| 부품 | 쓰는 화면 | 기준 시안·CSS | 지금 비슷한 것 | props |
|---|---|---|---|---|
| `LineMark` | ROUTE_GUIDE 카드·타임라인, QR 요약 판 | `route-guide-final.html` `.line-no`, `.bus-no`, `.line-tag`, 3-6절 | 없음 | `leg` |
| `StepNumber` | QR 단계 안내 | `qr-handoff-final.html` `.step-no` (LineMark 의 원과 같은 모양, 12-5절) | 없음 | `n` |
| `RouteLines` | 카드, 요약 판 | `route-guide-final.html` `.lines`, `.line-step`, R5 | 없음 | `route` |
| `RouteCard` | ROUTE_GUIDE (경로 2~3개) | `route-guide-final.html` `.card`, 3-2절 선택 표시 | `.route-best`, `.route-others` | `route`, `selected`, `onSelect` |
| `RouteSummary` | ROUTE_GUIDE (경로 1개), QR_HANDOFF | `route-guide-final.html` `.card.is-only`, `qr-handoff-final.html` `.summary`, R3, 12-5절 | 없음 | `route` |
| `Timeline` | ROUTE_GUIDE | `route-guide-final.html` `.timeline` 과 `timelineOf`, `drawRails`, `fitTimeline`, 3-6절, 9-1절 R2·R4·R7·R8 | 없음 | `route` |
| `QrBox` | QR_HANDOFF | `qr-handoff-final.html` `.qr-box`, 12-5절 | `.qr-url` | `url`, `status` |

### 2-4. 순수 로직과 훅 (React 없이 테스트한다)

| 파일 | 하는 일 | 옮겨 올 원본 |
|---|---|---|
| `view/placeName.js` | 끝의 "역"·"정류장" 떼기 (7절 규칙 2) | `idle-band.js` `displayPlaceName` |
| `view/placeBand.js` | 띠 줄 만들기 A~J (8-4절). 측정이 필요한 부분(이름 줄이기, 번호 채우기)은 입력으로 너비를 받는다 | `idle-band.js` `subwayRows`, `busRows`, `fitName`, `fillNumbers` |
| `view/routeView.js` | R1 걸러내기, R3 요약 판 여부, 역 라벨, "N번째 역에서 내려요", 타임라인 항목 목록(단계 ①~④ 별로), 도착 시각 | `route-guide-final.html` 의 `<script>` |
| `view/unavailableReason.js` | 오류 코드 → 그림·문구, 첫 ". " 에서 나누기 (12-3절) | `unavailable-final.html` `REASONS` |
| `view/pickName.js` | 이름에 띄어쓰기가 있는지 (6절 줄 바꿈 규칙) | `manual-select-final.html` `has-space` |
| `hooks/useFitText.js` | 넘치면 정한 단계씩 줄이기 (기다림 큰 글씨 10-2절, 띠 이름 7절) | `wait-final.html` 글씨 줄이기, `idle-band.js` `fitName` |
| `hooks/useNow.js` | 지금 시각 (Clock, 도착 시각) | `shared/v3.js` |
| `hooks/useInactivityCountdown.js` | 무입력 남은 초 | 새로 만든다 (4-2절) |

현재 위치를 들고 있는 `state/LocationContext.jsx` 는 4-2절에 적었다.

## 2-A. CSS·토큰 옮기기

### 2-A-1. 값 규칙 (2026-11-19 팀장 결정)

| 값의 범위 | 두는 곳 |
|---|---|
| 여러 부품이 함께 쓰는 값 | `global.css` 의 `:root` 토큰 |
| 한 부품 안에서만 쓰는 값 | 그 부품 CSS 파일 맨 위에 지역 CSS 변수로 모은다 (예: `.route-card { --check-size: …; }`). 규칙 본문에서는 그 변수만 쓴다 |
| 화면 파일(JSX) | 숫자와 색을 쓰지 않는다. `style={{ … }}` 에 값을 직접 넣지 않는다 (노선색처럼 데이터로 고르는 것은 토큰 이름을 고르는 것만 허용: `--c: var(--line-seoul-3)`) |

- 토큰 값이나 이름을 새로 정할 때는 `docs/design-guidelines.md` 3절을 먼저 고친다 (CLAUDE.md 디자인 규칙)
- 두 부품 이상이 같은 지역 변수를 쓰게 되면 `:root` 로 올린다

### 2-A-2. `global.css` `:root` 에 넣을 토큰 (1단계)

값은 오른쪽 출처를 그대로 옮긴다. 이름은 제안이며 1단계에서 디자인 문서 3절에 이름을 먼저 적는다.

| 묶음 | 토큰 이름 (제안) | 출처 |
|---|---|---|
| 칸 | `--pad`, `--band-thin-height`, `--content-left`, `--col-right`, `--col-gap` | 6절, `flow.css` `:root` |
| 큰 글씨 | `--font-display`, `--font-figure`, `--font-wait`, `--font-wait-min`, `--font-wait-step`, `--font-say` | 3-3절, `flow.css`, `wait.css`, `states.css` |
| 버튼 | `--btn-primary-height`, `--btn-depth`, `--btn-icon-primary`, `--btn-icon`, `--shadow-primary` | 3-1절 그림자, 3-4절 시안 값 표, `flow.css` |
| 모서리·테두리 | `--radius-primary`, `--radius-card`, `--radius-plate`, `--radius`(유지, 알림 판), `--border-thin`, `--border-width`(유지) | 3-4절 시안 값 표 |
| 고리 | `--ring-r`, `--halo-r`, `--ring-icon`, `--ring-width`, `--arc-width`, `--ring-center-y` | 3-4절, `flow.css`, `wait.css` |
| 카드 | `--card-height`, `--check-size`, `--mark-height` | 6절, 11-1절, 3-6절 (세 파일에 중복된 `--card-height` 를 하나로) |
| 움직임 | `--motion-press`, `--motion-screen`, `--motion-loop`, `--motion-wait` | 3-5절 |
| 노선색 | `--line-seoul-1/3/4/5`, `--bus-trunk/branch/express/circular`, `--line-none`, `--line-tint*`, `--ring-tint*` | 3-6절, 8-4절. **문서에 없는 것**: `idle-final.css` 의 `--line-arex`, `--line-gyeongui-jungang`, `--line-suin-bundang`, `--line-gtx-a` 는 3-6절 표에 먼저 넣는다 (모두 임시, 4절 13번) |
| 포커스 | `--focus-width`, `--focus-offset` | 3-4절 '포커스 외곽선' (4절 5번) |

### 2-A-3. 그대로 옮길 수 있는 CSS

부품 단위 규칙은 선택자 이름만 부품에 맞게 바꾸고 옮긴다. 직접 적힌 px·색은 2-A-1 규칙에 따라 토큰이나 지역 변수로 바꾼다.

| 시안 | 옮길 곳 |
|---|---|
| `flow.css` `.thin*` | `ThinBand.css` |
| `flow.css` `.right .btn*` | `Button.css` |
| `flow.css` `.ring-*`, `wait.css` `.ring-arc`·`@keyframes ring-spin`·`.ring-count`·`.ring-icon.is-line`, `states.css` `.ring-big*`·`.ring-small*` | `Ring.css` |
| `wait.css` `.wait*` | `WaitFrame.css` |
| `pick.css` `.picks`·`.pick*`, 각 화면 `<style>` 의 `.picks` 변형 | `PickList.css` |
| `pick.css` `.thin-alert` | `TimeoutNotice.css` |
| `states.css` `.stack`·`.core-line`·`.core-more`·`.heard`·`.say-label`·`.says`·`.is-error` | `RingStack.css`, `HeardLine.css`, `SayExamples.css` |
| `route-guide-final.html` `<style>` | `LineMark.css`, `RouteCard.css`, `Timeline.css` |
| `qr-handoff-final.html` `<style>` | `QrBox.css`, QR 화면 배치는 `FlowFrame` 안의 부품 CSS |
| `idle-final.css` | `PlaceBand.css`, `IdleButtons.css`, IDLE 질문 묶음 CSS |
| 각 파일의 `prefers-reduced-motion` 규칙 | 같은 부품 CSS |

### 2-A-4. 다시 짜야 하는 것

| 시안 | 이유 | React 에서 |
|---|---|---|
| `idle-band.js` 전체 | 그린 뒤 너비를 재서 이름 크기·번호/개수·숨김을 정한다 | `view/placeBand.js`(순수) + `PlaceBand` 의 `useLayoutEffect` 측정 |
| `route-guide-final.html` `fitTimeline`, `fitNames`, `drawRails` | 그린 뒤 넘침을 재서 단계 ①~④ 를 고르고, 점 위치를 재서 선을 그린다 | `Timeline` 의 `useLayoutEffect` 에서 단계를 올리며 다시 그린다. 선은 측정값을 상태로 들고 그린다 |
| `wait-final.html` 큰 글씨 줄이기 | 측정 | `useFitText` |
| `placeRingIcons()` | 안쪽 `<svg>` 의 x·y 를 CSS 로 못 바꾸는 브라우저가 있다 | `Ring` 이 토큰 값을 읽지 않고 viewBox 기준 속성으로 그린다. 크기 숫자는 `Ring.jsx` 가 아니라 CSS 변수에서 읽는 방법을 1단계에서 정한다 (JSX 에 숫자 금지) |
| `listening-final.html` 막대 스크립트 | 가짜 음량으로 매 프레임 그린다 | `VoiceMeter` + `requestAnimationFrame`, 음량은 녹음기에서 (12단계) |
| `innerHTML` 템플릿 | | JSX |
| `<service-name>`(`shared/brand.js`) | | `src/brand.js` 의 상수 하나 (디자인 문서 4절 10번, 5절) |
| `shared/base.css` | 예전 세로 캔버스 값이 남아 있고 `global.css` 를 다시 불러온다 | 옮기지 않는다 |
| `?left=`, `?freeze=`, `?case=`, `?set=` | 시안 확인용 | 옮기지 않는다. 같은 경우는 DevPanel·mock 시나리오(5절)로 본다 |

### 2-A-5. 지금 `global.css` 에서 고칠 것 (1단계)

- `#444444` 글씨를 본문색으로: `.screen .hint`, `.screen .route-others`, `.screen .text-input::placeholder` (3-1절 "글씨에는 쓰지 않는다")
- 머리 주석의 예전 값: 왼쪽 칸 1160, "보조 버튼은 주 버튼과 크기가 같다", "옅은 배경은 쓰는 곳이 없다", "배치 세로 1열"
- 예전 세로 틀(`.screen` flex, `.screen-actions`, `.btn-list`, `.route-best`, `.qr-url` 등)은 모든 화면을 옮길 때까지 남긴다. 새 부품 CSS 가 예전 규칙에 덮이지 않게, 새 틀은 `.screen` 이 아닌 자기 클래스(`.flow`, `.wait-frame`) 아래에만 건다. 다 옮긴 뒤 13단계에서 지운다

## 3. 만드는 순서

- 한 단계 = 한 세션. 단계를 시작할 때 7절에 줄을 하나 쓰고, 끝날 때 결과를 채운다
- 모든 단계의 공통 끝난 기준: `frontend/` 에서 `npm test -- --run`, `npm run lint` 통과. 화면을 바꿨으면 6-A절의 확인을 한다
- "고칠 테스트"는 그 단계에서 깨질 것으로 보이는 것이다. 깨지면 같은 단계에서 고친다
- "막히는 것"에 팀원이 필요한 것이 나오면 멈추지 않는다. 적힌 대체 동작으로 구현하고 `docs/team-requests.md` 에 적는다 (0-3절). 단계 중에 새로 생기면 그 파일에 한 줄 더한다

### 1단계 — 토큰 정리와 아이콘

| 항목 | 내용 |
|---|---|
| 할 일 | ① 디자인 문서 3절에 2-A-2절 토큰 이름을 적는다(3-4절 시안 값 표에 이름 열, 3-6절에 문서에 없던 노선 토큰 4개). ② `global.css` `:root` 에 토큰을 넣는다. ③ 2-A-5절의 #444 글씨와 머리 주석을 고친다. ④ 아이콘 SVG 를 `frontend/src/assets/icons/` 로 복사하고 라이선스 사본을 둔다. ⑤ `Icon`, `RingIcon` 부품. ⑥ `src/brand.js` (서비스 이름 "오아시스", 로고 SVG — 둘 다 **임시** 표시) |
| 바꿀 파일 | `docs/design-guidelines.md` 3절, `frontend/src/styles/global.css`, `frontend/src/assets/icons/*`(새), `components/Icon.jsx`, `components/RingIcon.jsx`, `src/brand.js` |
| 기준 시안 | `shared/flow.css`, `wait.css`, `states.css`, `pick.css`, `idle-final.css` 의 `:root`, `shared/icons/`, 고리 안 그림은 `wait-final.html`·`unavailable-final.html` 의 `<template>` |
| 끝난 기준 | 화면 모양은 #444 → 본문색 글씨만 바뀐다(스크린샷으로 확인). 아이콘 라이선스는 3-7절 대로 |
| 고칠 테스트 | 없음 |
| 막히는 것 | 없음 |

### 2단계 — 틀: 얇은 띠, 좌우 두 칸, 버튼, 위치 Context. LISTENING 에 적용

| 항목 | 내용 |
|---|---|
| 할 일 | ① `LocationContext`(4-2절)를 만들고 `CurrentLocation` 의 조회를 옮긴다. ② `Clock`, `ThinBand`(알림 자리는 비워 둔다), `FlowFrame`, `PrimaryButton`, `SecondaryButton`, `HomeButton`, `Ring`(arc 없음). ③ LISTENING 을 새 틀로: 화면 제목 대신 "듣고 있어요"(10-1절), 음량 막대 없이 고리만. ④ mock 입력창을 DevPanel 로 옮긴다(`recorder.onInput` 을 DevPanel 이 부른다). 실제 마이크 모드 안내 문구는 시안 그대로 |
| 바꿀 파일 | `state/LocationContext.jsx`(새), `App.jsx`(Provider), `components/` 새 부품과 CSS, `screens/ListeningScreen.jsx`, `components/DevPanel.jsx`, `components/CurrentLocation.jsx`(Context 를 읽게) |
| 기준 시안 | `listening-final.html`, `shared/flow.css`, `consistency-audit.md` 1·3·4·5절 |
| 끝난 기준 | LISTENING 스크린샷이 시안과 같다(음량 막대 제외). 띠 가운데 이름이 mock 위치에서 온다. DevPanel 에서 글을 넣으면 예전처럼 무음·무발화 타이머가 돈다. `titles.js` 의 LISTENING 제목은 지우지 않는다(테스트가 14개를 센다. 화면에서만 안 쓴다) |
| 고칠 테스트 | 없음 예상. 새 `components/__tests__/` 에 ThinBand 의 시각/알림 전환은 3·6단계에서 |
| 막히는 것 | 없음 |
| 나누기 | 길어지면 2-1(틀·얇은 띠·버튼)과 2-2(위치 Context·LISTENING·mock 입력창 이동)로 나눈다 |

### 3단계 — 기다림 화면 5개

| 항목 | 내용 |
|---|---|
| 할 일 | `WaitFrame`, `useFitText`, `Ring` 의 도는 호·줄어드는 호. STARTUP_CHECK, CHECKING, RESOLVING, ROUTING, FAIL_COUNT_CHECK 를 옮긴다. RESOLVING 의 들은 말이 비었을 때(10-3절) |
| 바꿀 파일 | `components/WaitFrame.*`, `Ring.*`, `hooks/useFitText.js`, 위 화면 5개 |
| 기준 시안 | `wait-final.html?s=…`, `wait.css`, 10-2·10-3·10-4절 |
| 끝난 기준 | 다섯 화면 스크린샷이 시안과 같다(호는 멈춘 그림으로 비교). 움직임 줄이기 설정에서 호가 멈추고 CHECKING 은 1초에 한 번 줄어든다. 긴 목적지 이름에서 큰 글씨가 줄어든다 |
| 고칠 테스트 | 없음 |
| 막히는 것 | STARTUP_CHECK 의 로고는 임시(4절 11번) |

### 4단계 — REASKING, UNAVAILABLE, 오류 코드

| 항목 | 내용 |
|---|---|
| 할 일 | ① 문서 먼저: `frontend-plan.md` 2-3절의 `error` 를 `{ code, message }` 로, 코드 목록을 적는다(4-1절). ② 핸들러(`resolving.js`, `routing.js`)와 real API 가 코드를 싣게 고친다. ③ `view/unavailableReason.js`, `errorMessage.js` 를 코드 기준으로. ④ `RingStack`, `HeardLine`, `SayExamples`. ⑤ 두 화면을 옮긴다 |
| 바꿀 파일 | `docs/frontend-plan.md`, `effects/handlers/resolving.js`, `routing.js`, `api/real/route.js`·`resolve.js`(코드 전달), `screens/errorMessage.js`, `view/unavailableReason.js`, `screens/ReaskingScreen.jsx`, `UnavailableScreen.jsx`, `components/DevPanel.jsx`(가짜 payload) |
| 기준 시안 | `reasking-final.html`(`?heard=`), `unavailable-final.html?r=noroute / close / scope / upstream / generic`, `states.css`, 12-1~12-3절 |
| 끝난 기준 | REASKING 2칸, UNAVAILABLE 5칸 스크린샷이 시안과 같다. 드문 이유는 시계 그림(12-3절). 서울 밖 문구는 6-1절 결정 전까지 지금 앱 문구 |
| 고칠 테스트 | `state/__tests__/kioskReducer.test.js`(error 값), `effects/__tests__/resolving.test.js`, `routing.test.js`(dispatch 하는 error), `screens/__tests__/titles.test.js` 의 `toDisplayMessage` 부분, `api/real/__tests__/real.test.js`(오류 경로) |
| 막히는 것 | 없음. 서울 밖 문구는 앱 문구로 두고 요청은 `team-requests.md` #8 |

### 5단계 — 고르는 카드: CONFIRMING, MANUAL_SELECT

| 항목 | 내용 |
|---|---|
| 할 일 | `PickList`/`PickCard`, `SmallRing`, `view/pickName.js`. CONFIRMING(후보 여러 개 / 1개 + '예'), MANUAL_SELECT(목록 / 불러오는 중 / 오류 / 말로 하기 숨김). mock 에 명동 후보와 12개 목록을 넣는다(5-2절) |
| 바꿀 파일 | `components/Pick*`, `SmallRing`, `screens/ConfirmingScreen.jsx`, `ManualSelectScreen.jsx`, `api/mock/resolve.js`, `api/mock/data/pois.js` |
| 기준 시안 | `confirming-final.html`(`?n=1`, `?set=myeongdong`, `?names=long`), `manual-select-final.html`(`?voice=0`, `?state=loading / error`, `?names=long`), `pick.css`, `states.css`, 11-1~11-3절, 12-4절, 6절 |
| 끝난 기준 | 7칸 스크린샷이 시안과 같다. 긴 이름 줄 바꿈이 6절 규칙대로. 목록이 스크롤 없이 들어간다 |
| 고칠 테스트 | `screens/__tests__/ManualSelectScreen.test.jsx`: 화면이 `LocationContext`·`HomeButton` 을 쓰면 mock 에 Provider 가 없어 실패한다 → 테스트용 Provider 도우미를 만든다. 버튼 찾기를 `textContent === '말로 하기'` 정확 비교에서 버튼 안 글자 기준으로 |
| 막히는 것 | 없음. 실제 이름 길이는 시안 목록으로 만들고 요청은 `team-requests.md` #11. 12개 초과(디자인 문서 4절 8번)는 본문 스크롤이 받는다 |

### 6단계 — 남은 시간 알림

| 항목 | 내용 |
|---|---|
| 할 일 | 무입력 핸들러가 마감 시각을 알리게 하고(4-2절), `useInactivityCountdown`, `TimeoutNotice`, `ThinBand` 의 알림 자리. 무입력 화면 6개 중 옮긴 화면부터 연결(나머지는 9·10단계에서 같은 부품) |
| 바꿀 파일 | `effects/handlers/inactivity.js`, `effects/inactivityClock.js`(새, 4-2절), `hooks/useInactivityCountdown.js`, `components/TimeoutNotice.*`, `ThinBand.jsx`, `docs/frontend-plan.md` 2-5절 표 |
| 기준 시안 | `confirming-final.html?left=15`, `manual-select-final.html?left=15`, `timeout-notice.js`, `pick.css`, 11-4절, 3-9절 의도한 예외 |
| 끝난 기준 | 남은 15초부터 알림이 보이고 숫자만 1초에 한 번 바뀐다. 화면을 누르면 사라지고 다시 60초. 띠 높이·본문이 움직이지 않는다. 개발 모드(8초)에서는 처음부터 보이는 것이 정상(5-4절) |
| 고칠 테스트 | `effects/__tests__/inactivity.test.js` (핸들러 구조가 바뀌면) |
| 막히는 것 | 없음 |

### 7단계 — IDLE, IDLE_REDUCED, 큰 띠

| 항목 | 내용 |
|---|---|
| 할 일 | ① 위치 결과에 `place`(8-5절)를 더한다: mock 은 지하철역·버스정류장·없음 세 가지(5-2절), real 은 서버가 줄 때까지 `place: null`. ② `view/placeName.js`, `view/placeBand.js`(+ 테스트), `PlaceBand`, `IdleButtons`, 질문·예시 묶음. ③ 두 화면을 옮기고 `CurrentLocation` 을 지운다. GPS 대체 안내 문구(`FALLBACK_HINT`)는 화면에서 빼고 DevPanel 에 보인다 |
| 바꿀 파일 | `api/mock/location.js`, `api/real/location.js`, `state/LocationContext.jsx`, `view/placeName.js`, `view/placeBand.js`, `components/PlaceBand.*`, `IdleButtons.*`, `screens/IdleScreen.jsx`, `IdleReducedScreen.jsx`, `components/CurrentLocation.jsx`(삭제), `DevPanel.jsx` |
| 기준 시안 | `idle-final-subway.html`, `idle-final-bus.html`, `idle-final-default.html`, `idle-reduced-final.html`, `idle-final.css`, `idle-band.js`, 7절, 8절 |
| 끝난 기준 | 4칸 스크린샷이 시안과 같다. 7절 표의 긴 이름 다섯 가지가 같은 결과(시안 `?name=` 값으로 비교). 마이크 둘레 고리는 움직임 줄이기에서 멈춘다 |
| 고칠 테스트 | `api/real/__tests__/real.test.js` 의 `getLocation` (`toEqual` 정확 비교라 `place` 필드가 생기면 실패) |
| 막히는 것 | 없음. 서버 장소 정보는 mock 세 가지와 real `place: null` 로 대신하고 요청은 `team-requests.md` #1. 노선색·역 구성(디자인 문서 4절 13·16번)은 임시값. 버스 번호는 시안 예시로 하고 요청은 `team-requests.md` #12 |

### 8단계 — 경로 데이터 모양 (화면 없음)

| 항목 | 내용 |
|---|---|
| 할 일 | ① `frontend-plan.md` 7절에 경로 모양(9-2절 형식)을 적는다. ② `view/routeView.js` 와 테스트(R1, R3, R4, R7, R8, 라벨, 구간 줄). ③ mock 경로를 9-2절 형식으로 바꾼다(5-2절). ④ `api/real/route.js` 가 서버 `steps[]` 를 `legs[]` 로 바꾼다(버스 종류, 정거장 수, 내리는 곳, 걷는 시간. 노선 ID·출구는 없으면 비움) |
| 바꿀 파일 | `docs/frontend-plan.md`, `view/routeView.js`(+ `view/__tests__/`), `api/mock/data/routes.js`, `api/mock/route.js`, `api/real/route.js`, `components/DevPanel.jsx`(가짜 routes) |
| 기준 시안 | `route-guide-final.html` 의 `<script>`, `route-cases.js`, 9-1·9-2절 |
| 끝난 기준 | `route-cases.js` 10가지 경우를 `routeView` 테스트로 옮겨 통과. 지금 ROUTE_GUIDE 화면은 `summary` 가 없어도 깨지지 않는다(이 단계에서 화면은 최소한만 맞춘다) |
| 고칠 테스트 | `api/real/__tests__/real.test.js` 의 route 부분, `state/__tests__/kioskReducer.test.js` 는 routes 모양에 상관없음 |
| 막히는 것 | 없음. 노선 ID·출구·마지막 걷는 구간·정거장 수·버스 종류 값 형식(`team-requests.md` #2~#6)은 mock 에 시안 값을 넣고, real 은 없으면 비운다(노선 원 회색, 출구 안 씀, 모르는 버스 종류는 "그 밖" 회색) |

### 9단계 — ROUTE_GUIDE 화면

| 항목 | 내용 |
|---|---|
| 할 일 | `LineMark`, `RouteLines`, `RouteCard`, `RouteSummary`, `Timeline`(R2 단계 ①~④, 선 그리기). 카드 고르기는 화면 안 상태(처음 1순위), 250ms 나타나기(3-5절). 남은 시간 알림 연결: 6단계 부품 그대로 `FlowFrame` 에 `countdown` 을 켠다(핸들러·`TimeoutNotice` 는 고치지 않는다) |
| 바꿀 파일 | 위 부품과 CSS, `screens/RouteGuideScreen.jsx` |
| 기준 시안 | `route-guide-final.html`(`?set=subway`, 기본(버스), `?set=long`, `?pick=2`, `?case=…` 10가지), 3-2절, 3-6절, 6절, 9절 |
| 끝난 기준 | 5칸(`consistency-audit.md` 23~27) 스크린샷이 시안과 같다. `?case=` 10가지에서 넘침 없음(시안의 `body.dataset.fit` 과 같은 결과). 카드를 눌러도 상태·이벤트가 바뀌지 않는다 |
| 고칠 테스트 | 없음 예상. 카드 고르기 화면 테스트를 새로 만든다 |
| 막히는 것 | 없음 (데이터 부족은 8단계 규칙대로 비운다) |

### 10단계 — QR_HANDOFF 화면

| 항목 | 내용 |
|---|---|
| 할 일 | `QrBox`, `StepNumber`, 단계 세 줄(새 문구, 12-5절), `RouteSummary` 재사용. 괄호 안내문 삭제. 불러오는 중·오류는 시안이 없으므로 `QrBox` 자리에 지금 문구를 글자로 둔다(6-1절 #9). 보내는 경로는 이 단계에서는 아직 `routes[0]`. 남은 시간 알림: 9단계와 같이 `FlowFrame` 의 `countdown` 을 켠다 |
| 바꿀 파일 | `components/QrBox.*`, `StepNumber.*`, `screens/QrHandoffScreen.jsx`, (QR 그림 방법에 따라) `package.json` |
| 기준 시안 | `qr-handoff-final.html`, 12-5절 |
| 끝난 기준 | 스크린샷이 시안과 같다(QR 무늬 제외) |
| 고칠 테스트 | 없음 |
| 막히는 것 | 없음. QR 그림을 만드는 방법(`team-requests.md` #10)이 정해지기 전에는 시안과 같은 크기의 자리에 주소 글자를 둔다. QR 그림은 정해진 뒤 따로 넣는다 |

### 11단계 — 고른 경로를 QR 로 보내기

| 항목 | 내용 |
|---|---|
| 시작 전 확인 | `git fetch --all` 뒤 다른 브랜치에 `frontend/src/state/` 변경이 있는지 본다: `git log --oneline HEAD..origin/<브랜치> -- frontend/src/state/` 를 `git branch -r` 의 모든 브랜치에 대해. **하나라도 있으면 멈추고 팀장에게 알린다** (어느 브랜치, 어떤 커밋, 바뀐 파일) |
| 할 일 | ① `docs/kiosk-workflow.md` 를 먼저 고친다: 전이 표 `ROUTE_GUIDE → QR_HANDOFF` 비고와 "전이가 아닌 화면 안 동작" 절에 `SEND_TO_PHONE_PRESSED({ routeId })` 를 적는다. 전이는 그대로. "팀 확인 필요" 줄은 "구현함. 팀 공유는 `docs/team-requests.md` #9" 로 바꾼다. ② `events.js` 주석, reducer 에 `selectedRouteId` 필드와 payload 저장, IDLE 로 갈 때 비우기. ③ `RouteGuideScreen` 이 고른 경로 id 를 싣는다. ④ `QrHandoffScreen` 이 그 경로로 QR 과 요약 판을 만든다. ⑤ `frontend-plan.md` 2-3절. ⑥ `team-requests.md` #9 "자세히"를 실제 구현 내용으로 고친다 (공유는 마지막에 한 번에, 0-3절) |
| 바꿀 파일 | `docs/kiosk-workflow.md`, `docs/frontend-plan.md`, `state/events.js`, `state/kioskReducer.js`, `screens/RouteGuideScreen.jsx`, `screens/QrHandoffScreen.jsx`, `api/real/qr.js`(경로별 주소), `components/DevPanel.jsx` |
| 기준 시안 | 12-6절 'QR 이 보내는 경로', `docs/kiosk-workflow.md` "전이가 아닌 화면 안 동작" 절 |
| 끝난 기준 | 2·3순위를 고르고 보내면 QR 화면 요약 판이 그 경로다. 전이 40개·이벤트 26개 그대로 |
| 고칠 테스트 | `state/__tests__/kioskReducer.test.js`(initialState 모양 `toEqual`, 세션 초기화 목록), `state/__tests__/transitions.test.js` 는 그대로 통과해야 한다 |
| 막히는 것 | 시작 전 확인에서 다른 브랜치의 `state/` 변경이 나올 때만. real 의 QR 주소는 경로 id 를 받지 못한다(지금 `api/real/qr.js` 는 마지막 경로 조회의 `landing_url` 하나): mock 만 고른 경로로 맞추고, real 은 같은 주소가 간다는 것을 7절에 적는다. 요청은 `team-requests.md` #7 |

### 12단계 — 듣는 중 음량 막대

| 항목 | 내용 |
|---|---|
| 할 일 | 녹음기에 음량 알림(`onLevel`)을 더한다: real 은 지금 읽는 analyser 값, mock 은 시안의 가짜 음량. `VoiceMeter` 를 LISTENING 에 넣는다 |
| 바꿀 파일 | `devices/realRecorder.js`, `devices/mockRecorder.js`, `effects/handlers/listening.js`(음량을 화면에 전달하는 길, 4-2절), `components/VoiceMeter.*`, `screens/ListeningScreen.jsx`, `docs/frontend-plan.md` 2-5절 'LISTENING 책임 분리' |
| 기준 시안 | `listening-final.html`, 3-5절 '듣는 중 표시의 모양', 깜빡임 한도 |
| 끝난 기준 | 스크린샷(시안 `?freeze=0.6` 과 같은 시각)이 같다. 움직임 줄이기에서 멈춘다. 실제 마이크 모드에서 말하면 막대가 움직인다 |
| 고칠 테스트 | `devices/__tests__/mockRecorder.test.js`(시그니처가 바뀌면), `effects/__tests__/listening.test.js` |
| 막히는 것 | 없음 |

### 13단계 — 시연 모드와 정리

| 항목 | 내용 |
|---|---|
| 할 일 | ① 시연 모드(5-1절) `.env.demo`, `npm run dev:demo`. ② 5절 흐름 다섯 가지를 실제 앱에서 지나간다. ③ 예전 `ScreenFrame`, `CurrentLocation`, `global.css` 의 예전 세로 틀 규칙을 지운다. ④ CLAUDE.md·디자인 문서의 "화면 배치는 아직 세로로 쌓는 예전 구조다" 문장들을 고친다. ⑤ `frontend/README.md` 에 시연 모드 |
| 바꿀 파일 | `frontend/.env.demo`(새), `frontend/package.json`, `components/ScreenFrame.jsx`(삭제), `styles/global.css`, `CLAUDE.md`, `docs/design-guidelines.md` 1절·머리, `frontend/README.md` |
| 기준 시안 | `demo.html` 의 `FLOWS` |
| 끝난 기준 | 다섯 흐름의 모든 화면(22장)이 확정 시안과 같다. 31칸 전체 6-A절 확인. 콘솔에 "표에 없는 전이" 경고 없음 |
| 고칠 테스트 | 지운 파일을 가리키던 테스트 |
| 막히는 것 | 없음 |

## 4. 데이터와 로직 변경

### 4-1. API 응답과 상태의 모양

| 항목 | 지금 | 바꾼 뒤 | 단계 | 문서 |
|---|---|---|---|---|
| 위치 | `{ name, text, source, snapped, accuracyM, reason }` | 위에 `place` 추가 (8-5절 형식, 없으면 null) | 7 | `frontend-plan.md` 7절 |
| 경로 | `{ id, rank, summary, durationMin, transfers, … steps[] }` | 9-2절 형식(`durationMin`, `transfers`, `exit`, `start`, `legs[]`) + `id`. `summary` 는 DevPanel·기록용으로 남겨도 된다 | 8 | `frontend-plan.md` 7절 |
| 오류 (`state.error`) | 문장 또는 코드 문자열 | `{ code, message }`. `code` 는 `NO_ROUTE`(경로 없음), `TOO_CLOSE`(가까움), `OUT_OF_SCOPE`(범위 밖), `UPSTREAM`(길 안내 못 받음), `NO_POI`(목적지 없음), `UNKNOWN`(공통 오류) 여섯 개 (이름 확정 2026-11-19). 12-3절 이유와 그림에 대응하고, 드문 이유는 `UNKNOWN` 이다. `message` 는 서버 문장이 있으면 그것 | 4 | `frontend-plan.md` 2-3절 (먼저) |
| 고른 경로 | 없음 (QR 은 `routes[0]`) | `selectedRouteId` (reducer, 이름 확정 2026-11-19), `SEND_TO_PHONE_PRESSED({ routeId })` | 11 | `kiosk-workflow.md` (먼저) → `frontend-plan.md` 2-3절 |
| 도착 시각 | 없음 | 화면에서 지금 시각 + `durationMin` (`view/routeView.js`) | 8 | — |

### 4-2. `state/` reducer 밖에 두는 것 (새 이벤트 없음)

| 무엇 | 어디에 | 이유 |
|---|---|---|
| 현재 위치 | `state/LocationContext.jsx`. App 이 Provider. IDLE 에 들어갈 때마다 다시 조회(지금 `CurrentLocation` 과 같은 때)하고 마지막 결과를 들고 있다. 실패하면 마지막 결과 유지 | 띠가 모든 화면에서 이름을 쓴다. reducer 에 넣으면 새 이벤트가 필요하다 (2026-11-19 결정) |
| 경로 카드 선택 | `RouteGuideScreen` 의 `useState` | 화면 안 동작 (`kiosk-workflow.md` "전이가 아닌 화면 안 동작"). 11단계부터는 '휴대폰으로 보내기' 를 누를 때만 payload 로 나간다 |
| 무입력 남은 시간 | `effects/inactivityClock.js`: 핸들러가 타이머를 걸고 지울 때 마감 시각을 적는 작은 저장소(구독 가능). 화면은 `useInactivityCountdown` 으로 읽는다. 타이머는 여전히 핸들러 하나만 건다 | 타이머를 두 곳에서 세면 어긋난다 |
| 음량 | 녹음기 `onLevel` → 작은 저장소 → `VoiceMeter` | 매 프레임 값이라 reducer 에 넣지 않는다 |
| mock 입력 글 | DevPanel 이 `recorder.onInput` 을 직접 부른다 | 화면 시안에 입력창이 없다 |

### 4-3. 먼저 고칠 문서

| 문서·절 | 고칠 것 | 단계 |
|---|---|---|
| `docs/kiosk-workflow.md` 확인 필요 9번 | 경로 카드 고르기 "시안 단계, 팀 확정 전" → **확정** (2026-11-19). 상태·전이는 그대로 | 1단계 전에 (이 계획 승인 직후) |
| `docs/design-guidelines.md` 2절 주 버튼 예외의 경로 카드 줄 | "시안 단계" → 확정 | 같음 |
| `docs/frontend-plan.md` 6절 8번 | "2·3순위는 표시만, 선택 불가" → 확정: 카드로 고른다 | 같음 |
| `docs/frontend-plan.md` 3절 표 ROUTE_GUIDE 줄 | "1순위 크게 + 2·3순위 작게" → 경로 카드 | 같음 |
| `docs/design-guidelines.md` 9-2절 표 `legs[].kind` 줄 | "버려짐" → 지금 서버(`server/routing.py`)가 `bus_type` 으로 넘기고 `api/real/route.js` 가 `busType` 으로 받는다. 값 형식은 확인 필요(6-1절 #7). 9-3절은 `team-requests.md` 번호로 바꿨다 (2026-11-19) | 같음 |
| `docs/design-guidelines.md` 3절 | 2-A-2절 토큰 이름, 노선 토큰 4개 | 1 |
| `docs/frontend-plan.md` 2-3절 | `error` 모양 | 4 |
| `docs/frontend-plan.md` 2-5절 | 무입력 남은 시간, LISTENING 음량·입력 | 6, 12 |
| `docs/frontend-plan.md` 7절 | 위치 `place`, 경로 `legs` | 7, 8 |
| `docs/kiosk-workflow.md` 전이 표·화면 안 동작 절 | `SEND_TO_PHONE_PRESSED({ routeId })` | 11 |
| CLAUDE.md, 디자인 문서 1절·머리 | "화면 배치는 아직 세로로 쌓는 예전 구조다" 문장 | 13 |

### 4-4. 백엔드 요청

백엔드 요청과 팀 공유는 `docs/team-requests.md` 에 모은다 (0-3절). 이 계획을 쓸 때 나온 것은 그 파일의 #1~#10 이다:
장소 정보 `place`(#1), 노선 ID(#2), 출구 번호(#3), 마지막 걷는 구간(#4), 정거장 수 확인(#5), `bus_type` 값 형식(#6), 경로마다 휴대폰 주소(#7), 범위 밖 문구(#8), 고른 경로 보내기 공유(#9), QR 그림을 누가 만드나(#10). 디자인 문서 4절에서 옮긴 것: 실제 목적지 이름 길이(#11), 실제 버스 번호와 버스 수(#12), 경로 없음 이유 구별(#13).

## 5. 시연용 mock

### 5-1. 시연 모드

이 절의 이름 `.env.demo`, `npm run dev:demo`, `VITE_DEMO`, 시나리오 `noRoute` 는 확정이다 (2026-11-19).

- `frontend/.env.demo`: `VITE_USE_MOCK=true`, 무입력 60초(`VITE_INACTIVITY_MS=60000`), 나머지 타이머는 운영 기본값. `npm run dev:demo` (`vite --mode demo`)
- 시연 모드에서는 DevPanel 을 처음에 숨긴다(Ctrl+Shift+D 로 켬). mock 입력은 DevPanel 에 있으므로 발표자는 패널을 켜고 말 대신 글을 넣는다 (실제 마이크로 시연할 때는 `dev:real`)
- `VITE_DEMO=true` 일 때 mock 목적지 목록에서 시험용 항목('외딴섬 선착장')을 뺀다. 경로 없음은 DevPanel 시나리오(`noRoute`, 5-3절)로 낸다
- 개발용 `.env.development` 의 8초는 그대로 둔다(빨리 확인용). 이때 알림이 처음부터 보이는 것은 정상이다

### 5-2. 데이터 (값은 시안 파일에서 그대로 가져온다)

| 데이터 | 넣을 곳 | 가져올 곳 |
|---|---|---|
| 장소: 종로3가역(지하철), 종로3가.탑골공원 정류장(버스), 없음 | `api/mock/data/places.js`(새), DevPanel 에서 고르기. 시연 기본은 지하철역 | `idle-final-subway.html`, `idle-final-bus.html`, `idle-final-default.html` 의 `window.PLACE` |
| 목적지 12개 | `api/mock/data/pois.js` | `manual-select-final.html` 의 `POIS` (명동역 포함). 시험용 항목은 5-1절대로 |
| "명동" → 후보 명동역·명동성당·명동입구 (확인 필요) | `api/mock/resolve.js` 키워드 | `confirming-final.html` `?set=myeongdong` 의 `CANDIDATES` |
| "병원" → 후보 3개 | 지금 그대로 | `confirming-final.html` 기본 |
| 경로: 지하철역 묶음 A·B·C | `api/mock/data/routes.js` | `route-cases.js` `ROUTE_SUBWAY` |
| 경로: 버스 묶음, 긴 경우, 경우 10가지 | 같은 파일, DevPanel 시나리오 | `route-guide-final.html` `SETS`, `route-cases.js` `ROUTE_CASES` |
| UNAVAILABLE 이유 5가지 | `api/mock/route.js`, `resolve.js` 시나리오 | `unavailable-final.html` `REASONS` |
| 예시 문구 | `IdleScreen`, `ReaskingScreen` 의 문구 상수 | `idle-final-subway.html`, `reasking-final.html` |
| 음량 | `devices/mockRecorder.js` | `listening-final.html` 의 `voice()` |

### 5-3. 흐름 다섯 가지 재현 (`demo.html` 의 `FLOWS`)

| # | 흐름 | 실제 앱에서 하는 것 |
|---|---|---|
| 1 | 기본 | 장소 지하철역 → '말하기' → DevPanel 에 "명동" → 후보 명동역 → 경로 A·B·C → 휴대폰으로 보내기 → 처음으로 |
| 2 | 다시 말하기 | '말하기' → "웅얼" → REASKING → 다시 말하기 |
| 3 | 안내 불가 | DevPanel 시나리오 `noRoute`(새) → 아무 목적지 → UNAVAILABLE(경로 없음) → 손으로 고르기 |
| 4 | 손으로 고르기 | '손으로 고르기' → 명동역 → ROUTE_GUIDE |
| 5 | 음성 불가 | 시나리오 `micDown` → IDLE_REDUCED → 손으로 고르기 → '말로 하기' 없음 |

- 시안은 기다림 화면을 눌러 넘기지만 실제 앱은 mock 지연(`api/mock/mockDelay.js`)으로 저절로 넘어간다. 시연에서 너무 빠르면 지연을 늘리는 env 를 둔다
- 시나리오 `noRoute` 와 이유별 시나리오는 이벤트가 아니라 mock 동작이다(`api/mock/scenario.js`)

## 6. 위험과 확인 필요

### 6-1. 확인 필요

| # | 항목 | 지금 처리 | 막는 단계 |
|---|---|---|---|
| 1 | 실물 기기 (디자인 문서 4절 1번) | 32인치 가로 가정 | 없음 |
| 2 | 로고 (4절 11번) | 시안의 원과 점 모양을 **임시**로 쓴다(`src/brand.js` 에 표시) | 없음 |
| 3 | 서비스 이름 겹침 (4절 22번) | "오아시스" 임시 | 없음 |
| 4 | 노선색·버스 종류 색 공식 값, 역 구성 (4절 13·16번), 버스 번호 (4절 17번, `team-requests.md` #12) | 임시값 | 없음 |
| 5 | 서울 밖 문구 (12-6절, `team-requests.md` #8) | 앱 문구 유지 | 없음 |
| 6 | 목적지 12개 초과 (4절 8번), 실제 이름 길이 (4절 14번, `team-requests.md` #11) | 12개 기준, 넘치면 본문 스크롤 | 없음 |
| 7 | `bus_type` 값 형식 (`team-requests.md` #6) | 모르는 값은 "그 밖" 회색 | 없음 |
| 8 | QR 그림을 만드는 방법: 프론트 라이브러리(오프라인, npm 의존성 추가) 또는 서버 이미지 (`frontend-plan.md` 6절 2번, `team-requests.md` #10) | 정해질 때까지 주소 글자 | 없음 (QR 그림만 나중에) |
| 9 | QR 불러오는 중·오류 모양 (12-5절 "그리지 않았다") | 지금 문구를 QR 자리에 글자로 | 없음 |
| 10 | QR 주소를 만드는 쪽이 경로 id 를 받을 수 있는지 (`team-requests.md` #7) | mock 만 맞춘다. real 은 같은 주소 | 없음 |
| 11 | `line_alternatives`(같은 구간에 서는 다른 버스, 서버가 이미 준다) | 이번 범위에서 표시하지 않는다. 시안에 규칙이 없다 | 없음 |
| 12 | 경로 없음 이유 구별 (4절 21번, `team-requests.md` #13) | 지금 이유 5가지 | 없음 |
| 13 | 이름 상자가 버튼처럼 보이는지, 옅은 선이 프로젝터에서 보이는지 (4절 15번, 8-6절) | 시연 뒤 사람에게 확인 | 없음 |
| 14 | 갈림길 표시 (4절 19번) | 그리지 않는다 | 없음 |

### 6-2. 기술 위험

| 위험 | 대응 |
|---|---|
| 측정해서 그리는 부분(큰 띠, 타임라인 선·넘침, 큰 글씨)이 글꼴을 다 읽기 전에 재면 틀린다 | 시안처럼 `document.fonts.ready` 뒤에 한 번 더 잰다. 테스트는 순수 로직(`view/`)만, 측정 결과는 스크린샷으로 |
| 예전 세로 틀과 새 틀이 함께 있는 동안 CSS 가 서로 덮는다 | 새 틀은 자기 클래스 아래에만 건다(2-A-5절). 13단계에서 예전 것을 지운다 |
| 화면 테스트가 Context(위치, 남은 시간)를 못 찾아 실패 | 5단계에서 테스트용 Provider 도우미를 만들고 이후 화면 테스트는 모두 그것을 쓴다 |
| StrictMode 에서 위치 조회·음량 구독이 두 번 | 지금 핸들러 규칙(`frontend-plan.md` 2-5절 'StrictMode 대응')대로 cancelled 플래그와 cleanup |
| 문서와 코드가 다시 어긋난다 (이번에 버스 종류에서 발견) | 4-3절 표를 단계마다 확인하고 7절에 적는다 |

## 6-A. 검증 방법

화면을 바꾼 단계마다 아래를 하고 결과를 7절에 숫자와 함께 적는다.

| # | 확인 | 방법 |
|---|---|---|
| 1 | 테스트·린트 | `frontend/` 에서 `npm test -- --run`, `npm run lint` |
| 2 | 시안과 같은지 | 1920×1080 창으로 실제 앱의 그 화면을 찍고, 같은 크기로 찍은 확정 시안(`design/mockups/confirmed/shots/` 또는 해당 `*-shoot.sh`)과 나란히 열어 본다(`shared/flow-compare.html`). 시각 글자와 움직이는 부분(호, 막대)은 차이로 보지 않는다 |
| 3 | 하한선 | 글씨 30px 미만 0, 버튼 112px 미만 0, 허용 조합 밖 글씨·배경 0, 스크롤 0 (디자인 문서 2절, 3-2절). 시안의 `shared/mock.js` 검사를 실제 앱 화면에서 돌릴 수 있게 DevPanel 에 '하한선 검사'를 두는 것을 2단계에서 검토한다 |
| 4 | 시선 순서 | 흐림(12px)·흑백·1/4 축소 그림을 **화면마다 열어서** 본다. 숫자 세 가지: 주 버튼 넓이 비율, 가장 큰 글씨 / 주 버튼 글씨, 칸이나 띠 밖의 요소 수 (3-9절). `consistency-audit.md` '결정과 결과' 의 값과 비교 |
| 5 | 움직임 | 움직임 줄이기 설정을 켜고 모두 멈추는지 (3-5절) |
| 6 | 흐름 | 5-3절 다섯 흐름을 손으로 지나간다. DevPanel 마지막 이벤트와 콘솔 "표에 없는 전이" 경고 없음 |
| 7 | 문서 | 4-3절 중 그 단계 몫을 고쳤는지 |

## 7. 진행 기록

| 날짜 | 단계 | 한 일 | 결과 (테스트·스크린샷·숫자) | 남은 것 / 다음 세션 |
|---|---|---|---|---|
| 2026-11-19 | 1 토큰 정리와 아이콘 | ① 4-3절 "1단계 전에" 문서 다섯 줄(경로 카드 확정 3곳, ROUTE_GUIDE 설명, 버스 종류). ② 디자인 문서 3절에 토큰 이름(3-4절 표에 토큰 열 + 새 표, 3-3·3-5·3-6절), 3-6절에 `idle-final.css` 에만 있던 노선색 9개(2·6·7·8·9호선, 공항철도, 경의중앙, 수인분당, GTX-A), 개정 15. ③ `global.css`: 머리 주석 새로 씀, `:root` 토큰 추가(2-A-2절 + 지역에서 쓰던 `--line-tint` 등, `:root.is-strong-lines`), 포커스 외곽선을 토큰으로, `.hint`·`.route-others`·입력창 안내글을 #444 → 본문색. ④ `src/assets/icons/` 에 Material 13개 + 띠 로고 + `ring/` 손 그림 5개, `LICENSE.txt`(npm `@material-symbols/svg-400@0.27.0` 의 LICENSE). ⑤ `components/iconSource.js`, `Icon`, `RingIcon`(+ CSS, 테스트 `components/__tests__/Icon.test.jsx`). ⑥ `src/brand.js`(이름·로고 임시) | 테스트 15파일 193개 통과(새 5개), lint 0. 지금 앱 14화면 1920×1080 전후 픽셀 비교: 11화면 0px, LISTENING 19,944px·ROUTE_GUIDE 7,363px·QR_HANDOFF 4,613px 로 모두 #444 글씨가 본문색으로 바뀐 곳뿐(눈으로 확인). 하한선 14화면: 30px 미만 글씨 0, 112px 미만 버튼 0, 허용 조합 밖 글씨·배경 0, #444 글씨 0, 스크롤 0. 아이콘 19개를 한 장에 그려 시안 그림과 같은 모양 확인. 화면 배치·시선 순서는 바뀌지 않아 흐림 검사는 하지 않음 | 2단계. 찍기 스크립트는 `.playwright-mcp/step1/`(git 제외)에 있다: 가짜 시계를 멈추고 DevPanel 이벤트 단추를 눌러 14상태를 찍는다. 다음 단계에서도 그대로 쓸 수 있다 |
| 2026-11-19 | 2 얇은 띠·좌우 두 칸 틀과 LISTENING | ⓪ 찍기 스크립트를 `.playwright-mcp/step1/` 에서 `frontend/scripts/screens/` 로 옮김: `shoot-screens.js`(14화면 찍기 + 하한선 숫자 + 흐림 그림), `compare-shots.js`(두 폴더 픽셀 비교), `serve-repo.mjs`(비교·시안 찍기용 저장소 서버), 사용법 `README.md`. 6-A절 3번의 "DevPanel 하한선 검사"는 만들지 않고 이 스크립트의 숫자로 대신함. ① `state/LocationContext.jsx`(IDLE·IDLE_REDUCED 에 들어갈 때마다 조회, 실패하면 마지막 결과 유지), `App.jsx` Provider, `CurrentLocation` 은 Context 를 읽기만. ② `hooks/useNow.js`, `Clock`, `ThinBand`(알림 자리는 아직 늘 시각), `FlowFrame`(+ `rightTop` 자리), `PrimaryButton`·`SecondaryButton`·`HomeButton`(`Button.css`, `.flow` 아래에만 걸림), `Ring`(arc 없음, 원은 CSS `r`·`cx`, 가운데 그림은 겹친 HTML 이라 x·y 속성 없음), `VoiceMeter`(시안 가짜 음량으로 움직임, 0.6초 모습부터 시작, 움직임 줄이기에서 멈춤). `RingIcon` 에 `mic`(Material) 추가. ③ `ListeningScreen` 을 새 틀로(제목 없음, "듣고 있어요"). ④ mock 입력창을 DevPanel 로(LISTENING·mock 일 때만), 녹음기에 `getText()`(mock 은 받은 글, real 은 빈 글) — '다 말했어요' 가 `SPEECH_END({ text })` 에 싣는다. 이벤트·payload 모양 그대로. 문서: `frontend-plan.md` 2-5절·3절 LISTENING 줄, 디자인 문서 머리·10절, `frontend/README.md` | 테스트 17파일 200개 통과(새 7개: LocationContext 4, Clock 2, getText 1. 아이콘 테스트에 mic 추가), lint 0. 1단계 끝 상태를 새 스크립트로 먼저 찍고(`shots/base-step1`) 비교: LISTENING 말고 13화면 0px. LISTENING 은 확정 시안(`listening-final.html?freeze=0.6`, 같은 시각)과 픽셀 비교 10,748px, 모두 띠 가운데 이름 상자(726,26 469×44) 안 — mock 위치가 "종로3가.탑골공원 정류장"이고 시안은 "종로3가"(아래 '시안과 다른 곳'). 음량 막대·고리·글·버튼은 0px. 자리: 표시 (140,174.8) 640, 고리 가운데 (460, 494.8), "듣고 있어요" y 822.8 높이 86.4, 버튼 y 572/784/920 — 시안과 같음. 하한선 14화면: 30px 미만 글씨 0, 112px 미만 버튼 0, 허용 조합 밖 0, 스크롤 0, LISTENING 주 버튼 1. 흐림 그림(앱·시안 나란히): 주 버튼과 듣는 중 표시가 먼저 보임. 주 버튼 넓이 5.2%(600×180), 가장 큰 글씨/주 버튼 글씨 72/48, 칸·띠 밖 요소 0 — 결정과 결과 값과 같음. 흐름: DevPanel 에 "병원" → 2.5초 뒤 RESOLVING(transcript "병원"), '다 말했어요' → RESOLVING("서울역"), 무입력 4초 → 빈 글로 RESOLVING, 취소·처음으로 → IDLE, "표에 없는 전이" 경고 0. 움직임 줄이기: 막대 멈춤, 버튼 transition 0s | 시안과 다른 곳: 띠 이름 끝의 "역"·"정류장" 떼기(7절 규칙 2)는 장소 종류가 필요해 7단계(`view/placeName.js`)로 미룸, 지금 mock 위치는 정류장 이름 그대로. 창이 딱 1920×1080 이면 DevPanel 이 오른쪽 아래 버튼을 덮는다(개발 도구, Ctrl+Shift+D). 다음: 3단계 기다림 화면 5개 |
| 2026-11-19 | 3 기다림 화면 5개 | ① `components/WaitFrame.jsx`·`.css`(띠 + 화면 가운데 고리 → 머리말 → 큰 글씨 → 안내, 고리 칸 340, 고리 가운데 y 495). ② `Ring` 에 `arc`(`spin` 도는 호 22%, `countdown` 줄어드는 호)·`progress`, `.ring-count`(120px, 숫자 폭 고정). 고리 크기·선은 LISTENING 과 같은 토큰. ③ `hooks/useFitText.js`(토큰 이름으로 시작·최소·단계·너비를 받는 공통 훅, `document.fonts.ready` 뒤에 다시 잼. 7단계 띠 이름에도 쓴다) + 순수 계산 `view/fitText.js`. ④ `hooks/useCountdown.js`(마감 − 지금. 보통은 매 프레임, 움직임 줄이기는 1초에 한 번이고 호도 1초 단위), `hooks/useReducedMotion.js`. ⑤ 화면 5개: STARTUP_CHECK(로고 `LOGO_RING_ICON`, 임시), CHECKING(`config.healthRetryMs` 에서 남은 초), RESOLVING(`state.transcript`, 비거나 공백뿐이면 10-3절 빈 값 규칙), ROUTING(`state.selectedPoi.name`, 없으면 RESOLVING 과 같은 규칙으로 제목만 — 안전장치), FAIL_COUNT_CHECK. 문구는 `titles.js` 그대로. 문서: 디자인 문서 10절 머리, `team-requests.md` #14 | 테스트 20파일 210개 통과(새 3파일 10개: fitText 3, countdownView 4, 기다림 화면 3), lint 0. 2단계 끝 그림(`shots/base-step2`)과 비교: 옮기지 않은 9화면 0px. 확정 시안(`wait-final.html?freeze=0`, ROUTING 큰 글씨·RESOLVING 들은 말은 앱 mock 값 "서울역"으로 맞춤, 호는 앱도 멈춤)과 픽셀 비교: RESOLVING·FAIL_COUNT_CHECK·ROUTING 10,748px, CHECKING 3,187px — 모두 띠 가운데 이름 상자 안(2단계와 같은 차이). STARTUP_CHECK 3,199px — 띠 이름(시작 점검 때는 아직 위치를 받지 않아 비어 있음) + "요" 끝 글자 가장자리 12px. 하한선 14화면: 30px 미만 0, 112px 미만 버튼 0, 허용 조합 밖 0, 스크롤 0. 흐림 그림 5장을 열어 봄: 큰 글씨 → 호 → 안내 순으로 보임. 주 버튼 0(버튼 없는 화면), 가장 큰 글씨/다음 글씨 112/48, 띠·가운데 묶음 밖 요소 0. 글씨 줄이기: 들은 말 19자 104px, 30자 72px, 60자는 72px 에서도 넘침(시안대로 자르지 않음). 빈 들은 말: 머리말·안내 없이 "말씀을 알아듣는 중이에요" 112px. 움직임 줄이기: 도는 호 animation none, CHECKING 3→2→1 이 1초마다, 호 100→66.67→33.33 | 시안과 다른 곳: 없음(띠 이름은 2단계와 같은 이유). 72px 로도 넘치는 긴 글은 정한 규칙이 없어 시안대로 두고 `team-requests.md` #14 에 적음. 찍을 때 도는 호는 진짜 시간으로 돌아서(가짜 시계가 CSS 움직임을 멈추지 않음) `.ring-arc{animation:none}` 를 넣고 찍었다 — `shoot-screens.js` 에 옵션으로 넣는 것은 다음 단계에서 검토. 다음: 4단계 REASKING, UNAVAILABLE, 오류 코드 |
| 2026-11-19 | 4 REASKING, UNAVAILABLE, 오류 코드 | ⓪ 3단계에서 남은 긴 글 규칙(팀장 결정): 72px 에서 고르게 최대 3줄, 말줄임 없음. 디자인 문서 10-2절에 적고 `useFitText` 에 `wrapAtMin`(최소 크기로도 넘치면 `data-wrap`), 줄 바꿈 모양은 `view/textWrap.js`(`evenWrapClass`: 띄어쓰기가 있으면 `keep-all`) + `global.css` `.wrap-even`. REASKING 핵심 줄·들은 말, UNAVAILABLE 이유 문장에도 씀. ① 문서 먼저: `frontend-plan.md` 2-3절 "오류 모양"(`{ code, message }`, 코드 여섯 개, 서버 코드 대응), 4절 예시 코드, 3절 UNAVAILABLE 줄. ② `state/errorCodes.js`(`ERROR_CODES`, `kioskError`), `api/apiError.js`(`ApiError`, `toKioskError`). real `route.js`: `ROUTE_TOO_CLOSE`→`TOO_CLOSE`, `UPSTREAM_ERROR`→`UPSTREAM`, 그 밖→`UNKNOWN`(쉬운 문장 실음). real `resolve.js`: 그 밖 실패 → `UNKNOWN`. 핸들러 `resolving.js`(OUT_OF_SCOPE 는 앱 문구), `routing.js`(NO_ROUTE·NO_POI). 이벤트·전이·payload 이름 그대로. ③ `view/unavailableReason.js`(코드 → 그림·기본 문구, 문장이면 그대로, `splitFirstSentence`), `errorMessage.js` 는 이것을 부르는 얇은 층. ④ `RingStack`, `HeardLine`, `SayExamples`(+ `screens/sayExamples.js`), `Ring` 의 `tone` soft·text. ⑤ 두 화면 이전. DevPanel: error 줄을 JSON 으로, '오류 이유' 고르기(FAKE_ERRORS 7개). ⑥ 찍기 스크립트 옵션 `stopArcs`, `reasons`, `extras`(+ README) | 테스트 22파일 222개 통과(새 2파일: unavailableReason·textWrap 7, 두 화면 4. 고친 것: resolving·routing 의 error 값 5개, routing 에 ApiError 1개 더함, real 에 코드 확인 3개), lint 0. 3단계 끝 그림(`shots/base-step3`)과 비교: 옮기지 않은 화면 0px(STARTUP_CHECK 만 12px — 3단계 때 시안과 달랐던 "요" 끝 가장자리 1×12, 이제 시안과 같다). 확정 시안(`reasking-final.html?heard=서울역`·`?heard=`, `unavailable-final.html?r=noroute/close/scope/upstream/generic`)과 픽셀 비교 7장 모두 10,748px, 띠 가운데 이름 상자 안뿐(2단계와 같은 이유). 하한선 21장: 30px 미만 0, 112px 미만 버튼 0, 허용 조합 밖 0, 스크롤 0, 주 버튼 1. 흐림 7장을 열어 봄: 주 버튼 → 고리·핵심 줄 → 나머지(12-1절), 주 버튼 600×180(5.2%), 가장 큰 글씨/주 버튼 글씨 72/48, 칸·띠 밖 요소 0. 긴 글: RESOLVING 20자 96px 1줄, 30자 72px 1줄, 40·60자 72px 2줄(x 140~1780 안). REASKING 들은 말 20·30자 2줄(예시 아래 끝 y 1051), 40·60자 3줄 → 예시가 y 1101 로 화면 밖 → 팀장 결정으로 3줄이면 예시를 숨김(디자인 문서 12-2절, `hooks/useLineCount.js`), 고친 뒤 모든 요소 아래 끝 1080 이하 | 시안과 다른 곳: 띠 이름(2단계와 같음). 새 규칙 두 가지(긴 글 3줄, REASKING 예시 숨김)는 시안에 없던 경우라 문서에 먼저 적었다. 찍을 때 DevPanel 이 커져서 창이 1920×1080 이면 LISTENING '다 말했어요' 를 덮는다(스크립트는 패널을 숨기므로 영향 없음). 다음: 5단계 고르는 카드 CONFIRMING, MANUAL_SELECT (`view/textWrap.js` 를 그대로 쓴다) |
| 2026-11-19 | 5 고르는 카드 (CONFIRMING, MANUAL_SELECT) | ① 부품: `components/PickList.jsx`(`variant` confirm 1열·이름 48·높이 168 / select 3열·이름 36·높이는 내용) + `PickCard.jsx` + `PickList.css`(크기 차이는 variant 클래스의 지역 변수), `SmallRing.jsx`·`.css`(고리 반지름 절반, 도는 호, 움직임 줄이기에서 멈춤). 이름 줄 바꿈은 4단계 `view/textWrap.js` 의 `evenWrapClass` 를 그대로 써서 2-4절의 `view/pickName.js` 는 만들지 않았다. ② `ConfirmingScreen`(제목·`HeardLine`·후보 여러 개는 고르는 카드, 1개는 72px 물음 + 분류 + 왼쪽 칸의 '예' 주 버튼) + `.css`, `ManualSelectScreen`(목록·불러오는 중·오류·'말로 하기' 숨김) + `.css`. 이벤트·버튼 종류·개수 그대로. ③ mock: `data/pois.js` 에 `MANUAL_POIS`(시안 12개), `MYEONGDONG`(명동역·명동성당·명동입구), `LONG_POIS`. `getPois` 는 12개, 시나리오 `longNames` 는 긴 이름 12개. `resolve` 에 "명동" 키워드(정확히 일치 다음). 예전 목적지("서울역", 병원 3개, '외딴섬 선착장')는 `POIS` 에 남겨 말로는 그대로 찾는다. ④ DevPanel: '후보 묶음'(hospital·myeongdong·one·long, RESOLVE_NEED_CONFIRM 의 payload 만), 시나리오 longNames. ⑤ 테스트 도우미 `screens/__tests__/providers.jsx`(`withProviders`, `LocationContext` 의 `StaticLocationProvider`). ⑥ `scripts/screens/shoot-pick.js`(9가지 경우를 앱·시안 나란히) | 테스트 23파일 229개 통과(새 1파일 7개: 화면 4, mock 데이터 3. 고친 것: `ManualSelectScreen.test.jsx` 에 Provider 도우미, 버튼 찾기를 `textContent.trim()` 으로), lint 0. 4단계 끝 그림(`shots/base-step4`)과 비교: 옮기지 않은 화면 19장 모두 0px. 확정 시안과 픽셀 비교 9장(후보 3개·명동·1개·긴 이름, 목록·말로 하기 숨김·불러오는 중·오류·긴 이름): 8장 3,187px, 모두 띠 가운데 이름 상자(883,26 155×44) 안 — 시안 "종로3가", 앱은 가짜 시계로 위치를 받기 전이라 빈 칸. 불러오는 중만 6,827px: 고리·글·버튼의 자리와 크기는 소수점까지 같고(고리 598,512.4 152×152, 글 545.02,698.4) 시안의 멈춘 호 움직임 때문에 생긴 글자 가장자리 차이. 카드 자리: CONFIRMING (140, 398/586/774) 1068×168, MANUAL_SELECT 3열 343px, 행 높이 129·129·129·176, 목록 아래 끝 842 — 시안과 같음. 긴 이름: 앱과 시안이 카드마다 같은 줄 수("국립현대미술관 서울관" 2줄, "서울특별시 동부병원 응급의료센터" 3줄, "동대문역사문화공원역" 2줄), 목록 아래 끝 1029(한계 1032). 하한선 18장(앱 9 + 시안 9): 30px 미만 0, 112px 미만 버튼 0, 허용 조합 밖 0, 스크롤 0, 본문 주 버튼은 후보 1개일 때만 1. 흐림 9장을 열어 봄: 후보·목록 → 제목 → 버튼, 후보 1개는 '예' → 물음. 숫자: '예' 600×180(5.2%), 후보 카드 묶음 1068×544(28%), 목록 묶음 1068×623(32%). 가장 큰 글씨/주 버튼 글씨: 후보 1개 72/48, 후보 여러 개 카드 이름 48 = 오른쪽 버튼 36보다 큼, 목록 제목 48/카드 36. 칸·띠 밖 요소 0. 흐름(진짜 시간, 움직임 줄이기 켬): "명동" → CONFIRMING 후보 3개 → 명동역 → ROUTE_GUIDE(selectedPoi poi-myeongdong-station), 손으로 고르기 → 12개 → 명동역 → ROUTE_GUIDE, '다른 곳 말하기' → LISTENING, 작은 고리 animation none, "표에 없는 전이" 경고 0 | 시안과 다른 곳: 띠 이름(2단계와 같은 이유). 손으로 고르기 목록이 시안 12개가 되어 시험용 '외딴섬 선착장'(경로 없음)은 목록에 없다 — 말로 "외딴섬 선착장" 이나 DevPanel '오류 이유' 로 낸다(5-1절의 시나리오 `noRoute` 는 13단계). team-requests 새 항목 없음(이름 길이는 #11 그대로). 다음: 6단계 남은 시간 알림 |
| 2026-11-19 | 6 남은 시간 알림 | ① `effects/inactivityClock.js`(마감 시각 저장소, 구독 가능): `inactivity` 핸들러가 타이머를 걸 때 `Date.now() + inactivityMs` 를 적고, 만료·cleanup 때 비운다. 타이머는 여전히 핸들러 하나. 상태·전이·이벤트 그대로. ② `hooks/useInactivityCountdown.js`(남은 초 올림, 초 경계마다만 다시 그림, `NOTICE_SECONDS` 15), `components/TimeoutNotice.jsx`·`.css`(`pick.css` `.thin-alert` 값, 지역 변수), `ThinBand` 의 `countdown`(15초 이하면 시각 자리를 알림이 대신), `FlowFrame` 의 `countdown`. CONFIRMING·REASKING·UNAVAILABLE·MANUAL_SELECT 에 켬. ROUTE_GUIDE·QR_HANDOFF 는 9·10단계 할 일에 적음. ③ `config.js`: 개발 모드에서만 주소 값으로 시간 설정을 덮어씀(`?inactivityMs=60000`). `.env.development` 의 8초는 그대로. ④ `scripts/screens/shoot-timeout.js`(4화면 × 보통·긴 띠 이름, 앱 `?inactivityMs=15000`, 시안 `?left=15`) | 테스트 25파일 239개 통과(새 10개: 핸들러 마감 시각 2, 남은 초 계산 4, 띠 알림 4. 깨진 것: 화면 테스트 4개가 `useSyncExternalStore` 서버 렌더 snapshot 없음 → 세 번째 인자 추가로 고침), lint 0. 알림 자리: 앱·시안 4화면 모두 판 (1378, 8) 494×80, 띠 96, 시안과 픽셀 비교에서 판 영역(x 1378~) 차이 0 — 다른 곳은 띠 이름(앱 mock 위치 "종로3가.탑골공원 정류장")과 CONFIRMING·REASKING 의 들은 말·후보(DevPanel 기본 데이터). MANUAL_SELECT·UNAVAILABLE 긴 이름 그림은 시안과 0px. 띠 이름과 판 거리: 종로3가.탑골공원 251px(시안·문서 11-4절 표와 같음), 앱 mock 이름(470px) 183px. 하한선 8장: 30px 미만 0, 112px 미만 버튼 0, 허용 조합 밖 0(흰 글씨/`#111111`), 스크롤 0. 흐림 4장 열어 봄: 판이 띠 오른쪽에 짙게 보임(3-9절 의도한 예외), 주 버튼 있는 화면(REASKING·UNAVAILABLE)은 그대로 주 버튼이 먼저, 칸·띠 밖 요소 0. 알림 없을 때(`?inactivityMs=60000`) 5단계 끝 그림(`shots/base-step5`) 22장 모두 0px(옮긴 4화면 포함). 실제 시간(18초 설정, MANUAL_SELECT): 3초 뒤 15 → 14 → 13 → 12 로 1초에 하나씩, 띠 높이 96·본문 위 96 그대로, 누르면 바로 시각으로 돌아가고 3.4초 뒤 다시 15부터, 1 다음에 IDLE. "표에 없는 전이" 경고 0 | 시안과 다른 곳 없음(띠 이름은 2단계와 같은 이유). team-requests 새 항목 없음. 다음: 7단계 IDLE, IDLE_REDUCED, 큰 띠 |
