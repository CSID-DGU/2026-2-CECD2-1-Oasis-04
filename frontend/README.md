# 키오스크 프론트엔드

고령자를 위한 **대중교통 경로 안내 키오스크** 화면입니다 (오아시스 팀, 동국대 종합설계2 × ㈜넥스브이).
버스정류장·지하철역 키오스크에서 "어디로 가시나요?" → 음성(또는 손) 입력 → 목적지 확인 → 경로 안내 → 휴대폰으로 전달까지를 React 로 만들었습니다.
화면은 1920×1080 가로 고정이고 창 크기에 맞춰 통째로 줄어듭니다. 14화면 모두 확정 시안(`design/mockups/confirmed/`)을 옮긴 모양입니다.

실행 모드는 셋입니다.

| 모드 | 명령 | 서버 | 마이크 | 쓰는 때 |
|---|---|---|---|---|
| 개발 (mock) | `npm run dev` | 가짜 | 가짜 (글 입력) | 화면 만들기·확인. 타이머가 짧다 (무입력 8초) |
| 실제 | `npm run dev:real` | STT 서버 + 경로 서버 | 실제 마이크 | 서버와 함께 시험 |
| 시연 | `npm run dev:demo` | 가짜 | 가짜 (정해진 문장) | 발표. 서버·인터넷·마이크 없이 다섯 흐름 |

## 1. 준비

| 항목 | 버전 | 확인 |
|---|---|---|
| Node.js | 20.19 이상 또는 22.12 이상 (Vite 8 요구) | `node -v` |
| npm | Node 에 포함 | `npm -v` |

명령은 모두 저장소 루트가 아니라 **`frontend/` 안에서** 실행합니다.

```bash
cd frontend
npm install          # 처음 한 번, package.json 이 바뀌었을 때
```

Windows PowerShell 에서 `npm` 이 "스크립트를 실행할 수 없으므로" 오류를 내면 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 를 한 번 실행하거나 `npm.cmd` 로 부릅니다.

## 2. 개발 모드 — `npm run dev`

```bash
npm run dev          # http://localhost:5173
```

- `.env.development` 를 읽습니다: mock, 타이머 짧게(무입력 8초, 무발화 4초 등). 무입력 화면에 들어가자마자 남은 시간 알림이 뜨는 것은 정상입니다
- 알림 없이 보고 싶으면 주소에 `?inactivityMs=60000` (개발 모드에서만 듣는 주소 값. `src/config.js`)
- 오른쪽 아래 **개발자 패널(DevPanel)** 이 기본으로 보입니다. **Ctrl + Shift + D** 로 켜고 끕니다

### 개발자 패널

| 항목 | 하는 일 |
|---|---|
| state, failCount, lastEvent, transcript, selectedPoi, error, config | 지금 상태 머신 안의 값 |
| mock 마이크 (LISTENING 에서만) | 말 대신 글을 넣습니다. 입력을 멈추고 2.5초 지나거나 화면의 '다 말했어요' 를 누르면 넘어갑니다 |
| 가짜 음량 | 듣는 중 음량 막대: 말하는 듯 / 조용함 / 큰 소리 / 끄기 |
| 장소 | 지금 계신 곳: 지하철역(종로3가역, 기본) / 버스정류장(종로3가.탑골공원) / 정보 없음 / 띠 시험 데이터 |
| mock 시나리오 + 처음부터(DEV_RESET) | 실패 상황 흉내. 시작 점검 시나리오는 고른 뒤 '처음부터' |
| 오류 이유, 후보 묶음, 질문 문구, 경로 묶음 | 이벤트 단추를 누를 때 실을 가짜 값 (UNAVAILABLE 이유, CONFIRMING 후보, ROUTE_GUIDE 경로 경우) |
| 가능한 이벤트 | 지금 상태에서 전이 표에 있는 이벤트를 바로 보냅니다 |

| 시나리오 | 결과 |
|---|---|
| `normal` | 모두 정상 (기본) |
| `serverDown` | 시작 점검에서 서버 불가 → CHECKING |
| `sttDown`, `micDown` | 음성 불가 → IDLE_REDUCED ('말하기' 없음) |
| `routeError` | 경로 조회 오류 → UNAVAILABLE |
| `noRoute` | 경로 없음 → UNAVAILABLE (시연 흐름 3번) |
| `poisError`, `qrError` | 목록·QR 을 못 만듦 (화면 문구만, 전이 없음) |
| `longNames` | 손으로 고르기 목록을 긴 이름 12개로 |

### mock 마이크에 넣는 말

| 입력 | 결과 |
|---|---|
| `명동` | 후보 명동역·명동성당·명동입구 → CONFIRMING |
| `병원` | 후보 3개 → CONFIRMING |
| 목적지 이름 그대로 (`서울역`, `명동역` 등) | 바로 ROUTING → ROUTE_GUIDE |
| `웅얼`, 빈 입력, 그 밖의 말 | 못 알아들음 → 1회째 REASKING, 2회째 MANUAL_SELECT |
| `하와이` | 안내 범위 밖 → UNAVAILABLE |
| `에러` | 서버 오류 → UNAVAILABLE |

목적지 목록은 `src/api/mock/data/pois.js`. 규칙이 겹치면 빈 입력·웅얼 → 하와이 → 에러 → 병원 → 이름 일치 → 명동 순서로 먼저 걸린 것이 이깁니다.

## 3. 실제 모드 — `npm run dev:real`

실제 마이크로 녹음해 서버 두 개에 보냅니다. 서버를 먼저 띄우고 프론트를 켭니다.

| 서버 | 하는 일 | 기본 주소 | 띄우는 방법 (저장소 루트에서, 파이썬 가상환경은 루트 `README.md`) |
|---|---|---|---|
| STT 서버 `stt/api.py` | `/api/v1/` 아래 음성 인식 `stt`, 목적지 해석 `resolve`, 지금 위치 `location`, 목록 `pois`, 점검 `health` | http://localhost:8001 | `python stt/api.py` (포트는 `PORT`, 설정은 `stt/config.yaml`, 어댑터는 `STT_ADAPTER`. 설명은 파일 맨 위) |
| 경로 서버 `server/app.py` | 대중교통 경로 `/routes/transit` | http://localhost:8000 | `cd server` 뒤 `uvicorn app:app --port 8000` (환경변수 `KAKAO_REST_API_KEY` 필요) |

```bash
npm run dev:real     # http://localhost:5173. vite 가 /api 는 STT 서버로, /routes 는 경로 서버로 넘긴다
```

- 설정은 `.env.real` (키오스크 ID `VITE_KIOSK_ID`, 타이머는 운영값). 서버 주소가 기본과 다르면 `STT_SERVER_URL=... ROUTE_SERVER_URL=... npm run dev:real` (`vite.config.js`)
- 브라우저가 마이크 권한을 물으면 허용합니다. 위치 권한을 거절하면 서버 설정의 고정 위치를 씁니다 (DevPanel 위치 줄에 이유가 나옵니다)
- 빌드로 돌릴 때: `npm run build:real` 로 `dist/` 를 만들면 STT 서버가 `/` 에서 함께 보여 줍니다 (`FRONTEND_DIST`). 이때 경로 서버 주소는 `.env.real` 의 `VITE_ROUTE_API_BASE_URL` 에 적고, 경로 서버가 화면 출처를 허용(CORS)해야 합니다

## 4. 시연 모드 — `npm run dev:demo`

발표용입니다. **서버·인터넷·마이크 없이** 확정 시안 `design/mockups/confirmed/demo.html` 의 다섯 흐름을 실제 앱으로 보여 줍니다.

```bash
npm run dev:demo     # http://localhost:5173 (이미 쓰고 있으면 vite 가 5174 처럼 다음 자리를 알려 준다)
```

브라우저를 전체 화면(F11)으로 열고 화면을 한 번 누른 뒤 키보드(또는 발표용 리모컨)로 넘깁니다. 화면에는 발표자용 표시가 아무것도 나오지 않습니다.

| 키 | 하는 일 |
|---|---|
| **→** 또는 PageDown | 다음 화면 (화면 버튼을 누른 것과 같은 이벤트를 보냅니다. 흐름의 마지막 화면에서는 아무 일도 하지 않습니다) |
| **←** 또는 PageUp | 이전 화면 |
| **Home** | 지금 흐름의 처음 화면 |
| **1 ~ 5** | 그 흐름의 처음 화면 |
| Ctrl + Shift + D | 개발자 패널 (시연 모드에서는 처음에 숨겨져 있습니다) |

| 키 | 흐름 | 화면 순서 | 들은 말 |
|---|---|---|---|
| 1 | 기본 | IDLE → LISTENING → RESOLVING → CONFIRMING → ROUTING → ROUTE_GUIDE → QR_HANDOFF → IDLE | "명동" → 명동역을 고름 |
| 2 | 다시 말하기 | LISTENING → RESOLVING → FAIL_COUNT_CHECK → REASKING → LISTENING | "웅얼웅얼" |
| 3 | 안내 불가 | ROUTING → UNAVAILABLE(경로 없음) → MANUAL_SELECT | — |
| 4 | 손으로 고르기 | IDLE → MANUAL_SELECT → ROUTING → ROUTE_GUIDE | — |
| 5 | 음성 불가 | IDLE_REDUCED → MANUAL_SELECT ('말로 하기' 없음) | — |

- 기다림 화면(RESOLVING, ROUTING 1.5초, FAIL_COUNT_CHECK 1.2초)은 저절로 넘어갑니다. 기다리는 중에 →를 누르면 바로 넘깁니다
- 손으로 화면을 눌러 진행해도 됩니다. 키는 지금 화면이 흐름의 몇 번째인지 다시 찾아 이어 갑니다. '다 말했어요' 도 정해진 문장을 보냅니다
- 듣는 중 음량 막대는 가짜 음량으로 움직입니다. 무입력·무발화·재점검 시간은 10분이라 시연 중 처음으로 돌아가지 않습니다
- ROUTE_GUIDE 에서 →는 1번 경로를 보냅니다. 다른 경로를 보여 주려면 카드를 누르고 화면의 '휴대폰으로 보내기' 를 누릅니다
- 키는 새 상태·전이·이벤트를 만들지 않습니다. ←·Home·숫자 키는 `DEV_RESET`(개발 도구 이벤트) 뒤 그 화면까지의 이벤트를 한 번에 보내 바로 그 화면에 섭니다 (`src/demo/demoFlows.js`, `DemoKeys.jsx`)
- 설정은 `.env.demo`. 흐름을 고치려면 `src/demo/demoFlows.js` 와 `design/mockups/confirmed/demo.html` 을 함께 고칩니다

## 5. 테스트·린트

```bash
npm test -- --run    # 테스트 전체 한 번 (npm test 만 치면 파일 변경을 지켜보는 모드)
npm run lint         # ESLint
```

| 위치 | 내용 |
|---|---|
| `src/state/__tests__/` | 전이 표가 `docs/kiosk-workflow.md` 와 같은지, reducer 규칙, 위치 Context |
| `src/effects/__tests__/` | 상태별 핸들러: API 결과 → 이벤트, 타이머, cleanup 뒤 dispatch 없음 |
| `src/screens/__tests__/`, `src/components/__tests__/` | 화면·부품이 그리는 것과 보내는 이벤트 |
| `src/view/__tests__/`, `src/hooks/__tests__/` | 화면 계산 (글씨 줄이기, 띠, 경로 모양, QR, 음량) |
| `src/devices/__tests__/` | mock 녹음기 타이머 |
| `src/demo/__tests__/` | 시연 흐름이 demo.html 과 같은 순서인지, 모든 화면에 갈 수 있는지 |

`transitions.test.js` 는 저장소의 `docs/kiosk-workflow.md` 를 직접 읽으므로 저장소 전체를 받은 상태에서 돌립니다.

## 6. 화면 찍기·비교·시연 흐름 시험 (`scripts/screens/`)

Playwright 를 의존성으로 넣지 않았으므로, Claude Code 의 Playwright MCP(`browser_run_code`)에 파일 이름을 주고 돌립니다. 자세한 것은 [`scripts/screens/README.md`](scripts/screens/README.md).

| 파일 | 하는 일 |
|---|---|
| `shoot-screens.js` | 14화면(+ UNAVAILABLE 이유별)을 1920×1080 으로 찍고 하한선 숫자(글씨 30px, 버튼 112px, 색 조합, 스크롤)를 돌려줍니다 |
| `shoot-pick.js`, `shoot-timeout.js`, `shoot-route.js`, `shoot-qr.js`, `shoot-confirm-text.js` | 화면별 여러 경우를 앱과 시안에서 나란히 찍습니다 |
| `compare-shots.js` + `serve-repo.mjs` | 두 그림 폴더를 픽셀로 비교합니다 |
| `demo-flows.js` | 시연 모드 다섯 흐름을 → 키로 끝까지 돌려 화면 순서가 demo.html 과 같은지 봅니다 (`npm run dev:demo` 를 먼저) |

최종 화면 그림은 `design/after/`, 옮기기 전과 나란히 보는 페이지는 `design/compare.html` 입니다.

## 7. 폴더 구조

```
frontend/
  .env.development / .env.production / .env.real / .env.demo   모드별 설정 (비밀 값을 넣지 않는다)
  scripts/screens/        화면 찍기·비교·시연 흐름 시험
  src/
    App.jsx               Provider, 상태에 맞는 화면 하나, DevPanel, (시연 모드) 발표자 키
    config.js             시간 설정값과 시연 모드 여부. env 를 읽고 없으면 운영 기본값
    state/                상태 머신 (states, events, transitions, kioskReducer) + KioskContext, LocationContext
    effects/              상태에 들어갔을 때 하는 일 (API 호출, 타이머). handlers/ 에 상태별로
    api/                  서버와 통신하는 유일한 곳. mock/ 과 real/ 을 VITE_USE_MOCK 으로 고른다
    devices/              마이크 (mockRecorder / realRecorder)
    screens/              상태 하나 = 화면 하나 (14개)
    components/           틀(FlowFrame, WaitFrame, IdleFrame, Stage), 띠, 버튼, 고리, 카드, 타임라인, QR, DevPanel
    view/                 React 없는 화면 계산 (테스트하기 쉽게 분리)
    hooks/                화면 여러 곳이 쓰는 훅
    demo/                 시연 모드 흐름과 발표자 키
    styles/global.css     토큰(:root)과 공통 규칙. 부품 CSS 는 각 부품 옆에
    assets/               글꼴(Pretendard), 아이콘, 라이선스
```

- **state/** 는 "어느 상태에서 어떤 이벤트가 오면 어디로 가나" 만 압니다 (도메인 규칙). 상태·전이를 바꿀 때는 `docs/kiosk-workflow.md` 를 먼저 고칩니다
- **effects/** 는 결과를 전이 표에 있는 이벤트로만 보냅니다 (서비스 계층)
- **api/**, **devices/** 만 바깥과 닿습니다 (Repository/Client). 실제 서버로 바꿀 때 화면·reducer 는 손대지 않습니다

기준 문서: 화면 흐름 `docs/kiosk-workflow.md`, 설계 `docs/frontend-plan.md`, 디자인 `docs/design-guidelines.md`, 시안 옮기기 기록 `docs/design-implementation-plan.md`.
