# 키오스크 프론트엔드 프로토타입

고령자를 위한 **대중교통 경로 안내 키오스크**의 화면 흐름 프로토타입입니다 (오아시스 팀, 동국대 종합설계2 × ㈜넥스브이).
버스정류장·지하철역에 설치되는 키오스크에서 "어디로 가시나요?" → 음성(또는 손) 입력 → 목적지 확인 → 경로 안내 → 휴대폰으로 전달까지의 흐름을 React로 구현했습니다.
백엔드·STT·LLM이 아직 없으므로 **모든 서버 API와 마이크는 mock(가짜)** 으로 동작합니다. 나중에 실제 API로 바꿀 때 화면·상태 로직은 그대로 두고 `src/api/real/` 만 채우면 되도록 설계했습니다.

## 1. 실행 방법

### 요구 사항

| 항목 | 버전 | 확인 명령 |
|---|---|---|
| Node.js | **20.19 이상 또는 22.12 이상** (Vite 8 요구사항) | `node -v` |
| npm | Node에 포함 (10.x) | `npm -v` |

Node가 없으면 https://nodejs.org 에서 LTS를 설치하세요.

### 명령어

저장소 루트가 아니라 **`frontend/` 폴더 안에서** 실행합니다.

```bash
cd frontend
npm install        # 의존성 설치 (처음 한 번, package.json 이 바뀌었을 때)
npm run dev        # 개발 서버 → 브라우저에서 http://localhost:5173
npx vitest run     # 테스트 전체 1회 실행 (npm test 는 파일 변경을 감시하는 모드로 켜진다)
npm run build      # 운영 빌드 → dist/ 폴더 생성
npm run preview    # 빌드 결과물 확인 → http://localhost:4173
npm run lint       # ESLint 검사
```

개발 서버(`npm run dev`)는 `.env.development`를 읽어 타이머가 짧게(무입력 8초 등) 돌고, 빌드(`npm run build`)는 `.env.production`을 읽어 운영값(60초 등)으로 돕니다. 둘 다 mock입니다.

### Windows PowerShell에서 `npm` 이 "스크립트를 실행할 수 없으므로" 오류가 날 때

PowerShell을 열고 아래를 한 번 실행하면 됩니다 (현재 사용자에게만 적용, 관리자 권한 불필요). 또는 `npm` 대신 `npm.cmd`로 실행해도 됩니다.

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 2. 폴더 구조

```
frontend/
  index.html              진입 HTML
  .env.development        npm run dev 가 읽는 설정 (mock + 짧은 타이머)
  .env.production         npm run build 가 읽는 설정 (당분간 mock + 운영 타이머)
  src/
    main.jsx              React 를 DOM 에 붙이는 진입점
    App.jsx               Provider 로 감싸고 현재 상태에 맞는 화면 하나를 고른다 (라우터 역할)
    config.js             시간 설정값. env(VITE_*_MS) 를 읽고 없으면 운영 기본값
    state/                상태 머신 (순수 로직)
      states.js             상태 14개 (문서 이름 그대로)
      events.js             이벤트 26개 + 개발용 DEV_RESET
      transitions.js        전이 표 { 상태: { 이벤트: 다음상태 } } 40항목
      kioskReducer.js       reducer. 다음 상태 결정 + payload 저장 + failCount 증감만 한다
      KioskContext.jsx      Provider 와 useKiosk() 훅
    effects/              상태에 "들어갔을 때" 하는 일 (API 호출, 타이머)
      useKioskEffects.js    상태가 바뀔 때 해당 핸들러를 실행하고, 떠날 때 cleanup
      handlers/             상태별 핸들러 (startupCheck, checking, idleReduced, listening, resolving, failCountCheck, routing, inactivity)
    api/                  서버와 통신하는 유일한 곳
      index.js              VITE_USE_MOCK 을 보고 mock / real 중 하나를 내보낸다
      mock/                 가짜 구현 (키워드·시나리오로 분기, 300~800ms 지연)
      real/                 실제 구현 자리 (지금은 "Not implemented" throw)
    devices/              브라우저 장치(마이크) 추상화. 서버가 아니라 장치라서 api/ 와 분리
      recorder.js           mock / real 선택
      mockRecorder.js       텍스트 입력을 음성 대신 받고 무발화·무음 타이머를 흉내
      realRecorder.js       MediaRecorder 자리 (stub)
    screens/              상태 하나 = 화면 하나 (14개). titles.js 에 화면 제목 14개
    components/           공통 부품. ScreenFrame(제목+본문+버튼 틀), DevPanel(개발자 패널)
    styles/global.css     고령자 UI 스타일 (글씨 32px 이상, 버튼 96px, 고대비)
```

역할을 한 줄로 요약하면 다음과 같습니다. Spring에 익숙하다면 괄호 안 비유를 참고하세요.

- **state/**: "지금 어느 상태이고 어떤 이벤트가 오면 어디로 가는가"만 안다. API·타이머를 모른다 (도메인 규칙).
- **effects/**: 상태에 들어가면 API를 부르거나 타이머를 걸고, 결과를 **표에 있는 이벤트로만** dispatch 한다 (서비스 계층).
- **api/**, **devices/**: 바깥 세계와 닿는 유일한 두 곳 (Repository/Client). 여기 말고는 어디서도 fetch 하지 않는다.
- **screens/**: 상태를 그리고 버튼을 누르면 이벤트를 dispatch 한다. 표시용 조회(`getPois`, `createQr`)만 예외로 직접 부른다 (Controller/View).

## 3. 화면 흐름

상태 다이어그램과 전이 표(41행)는 [`docs/kiosk-workflow.md`](../docs/kiosk-workflow.md)가 기준입니다. 코드는 이 표를 1:1로 옮긴 것이고, `npx vitest run`이 문서와 `transitions.js`가 같은지 검사합니다.
구현 계획과 설계 결정은 [`docs/frontend-plan.md`](../docs/frontend-plan.md)에 있습니다. 상태나 전이를 바꾸려면 코드보다 문서를 먼저 고칩니다.

대표 흐름: `STARTUP_CHECK → IDLE → LISTENING → RESOLVING → (CONFIRMING →) ROUTING → ROUTE_GUIDE → QR_HANDOFF`

## 4. mock 키워드

마이크 대신 **텍스트 입력창**이 뜹니다 (`LISTENING` 화면). 아래 글자를 넣고 '다 말했어요'를 누르거나 잠시 기다리면 해당 흐름을 탑니다.

| 입력 | 결과 | 도착 화면 |
|---|---|---|
| `서울역` (목적지 이름과 정확히 일치) | 바로 확정 | ROUTING → ROUTE_GUIDE |
| `병원` | 후보 3개(동국대병원·서울병원·중앙병원) 중 고르기 | CONFIRMING |
| `웅얼` | 못 알아들음. 1회째 → 다시 묻기, 2회째 → 손으로 고르기 | REASKING → MANUAL_SELECT |
| (빈 입력) | 아무것도 치지 않고 기다리면 무발화 타이머가 빈 텍스트로 보냄. `웅얼`과 같은 흐름 | REASKING |
| `하와이` | 안내 범위 밖 | UNAVAILABLE |
| `에러` | STT 서버 오류(throw) | UNAVAILABLE |
| 그 외 아무 말 | 못 알아들음 (`웅얼`과 같음) | REASKING |
| **경로 없음 테스트** | '손으로 고르기'에서 **외딴섬 선착장** 선택 → 경로 0개 | UNAVAILABLE |

정확히 일치하는 목적지 이름 목록은 `src/api/mock/data/pois.js`에 있습니다 (서울역, 시청, 동국대학교, 남산타워, 고속터미널, 동국대병원, 서울병원, 중앙병원, 남대문시장, 외딴섬 선착장).
키워드가 겹치면 mock은 **빈 입력·`웅얼` → `하와이` → `에러` → `병원` → 이름 정확히 일치** 순으로 먼저 걸리는 규칙을 적용합니다. 예를 들어 `병원 에러`는 `에러`가 먼저 걸려 UNAVAILABLE로 갑니다.

## 5. DevPanel (개발자 패널)

화면 **우하단의 작은 회색 상자**입니다. 개발 도구이므로 고령자 UI 기준(큰 글씨)에서 제외되어 있습니다.

- `npm run dev`에서는 **기본으로 보이고**, `npm run build` / `npm run preview` 결과물에서는 **기본으로 숨겨집니다**.
- 어느 쪽이든 **Ctrl + Shift + D** 를 누르면 켜고 끌 수 있습니다 (시연 중 상태 확인용). 키오스크에 키보드가 없으면 빌드에서는 볼 수 없습니다.

보여 주는 것: 현재 상태(`state`), `failCount`, 마지막 이벤트, `transcript`, `selectedPoi`, `resolve.status`, `error`(원래 오류 코드), 지금 적용 중인 시간 설정값(`config`).

할 수 있는 것:

- **scenario 드롭다운**: mock API와 mock 마이크의 실패 상황을 강제합니다. 바꾼 뒤 해당 화면에 다시 들어가면 적용됩니다.
- **처음부터 (DEV_RESET)**: 어느 상태에서든 초기 상태(`STARTUP_CHECK`)로 되돌립니다. 워크플로우에 없는 개발용 이벤트입니다.
- **가능한 이벤트 버튼**: 현재 상태에서 표에 있는 전이를 버튼으로 직접 쏩니다. API나 타이머를 기다리지 않고 화면을 건너뛸 때 씁니다.

| 시나리오 | 영향 | 결과 |
|---|---|---|
| `normal` | 모두 정상 | 기본값 |
| `serverDown` | `health()` → 서버 불가 | 시작 시 CHECKING. 재시도 타이머 후 재점검 |
| `sttDown` | `health()` → STT 불가 | IDLE_REDUCED (마이크 버튼 숨김). 재점검 타이머 후 복구 확인 |
| `micDown` | `checkMic()` → 마이크 불가 | IDLE_REDUCED |
| `routeError` | `route()` throw | ROUTING → UNAVAILABLE |
| `poisError` | `getPois()` throw | MANUAL_SELECT에 "목록을 불러올 수 없어요" (전이 없음) |
| `qrError` | `createQr()` throw | QR_HANDOFF에 "QR을 만들지 못했어요" (전이 없음) |

시작 점검 시나리오(`serverDown`, `sttDown`, `micDown`)를 시험하려면 드롭다운을 바꾼 뒤 **처음부터 (DEV_RESET)** 를 누르세요.

## 6. 시간 설정값

`src/config.js`가 env에서 읽습니다. 핸들러와 recorder는 이 값만 보고 숫자를 직접 쓰지 않습니다. DevPanel의 `config` 줄에서 지금 적용 중인 값을 확인할 수 있습니다.

| 키 | env 변수 | 운영값 (`.env.production`, 비워 두면 기본값) | 개발값 (`.env.development`) | 쓰는 곳 |
|---|---|---|---|---|
| `healthRetryMs` | `VITE_HEALTH_RETRY_MS` | 30000 (30초) | 3000 | CHECKING: 서버 재시도 |
| `recheckMs` | `VITE_RECHECK_MS` | 60000 (60초) | 5000 | IDLE_REDUCED: 마이크·STT 재점검 |
| `noSpeechMs` | `VITE_NO_SPEECH_MS` | 10000 (10초) | 4000 | LISTENING: 무발화 → 빈 텍스트 |
| `silenceMs` | `VITE_SILENCE_MS` | 2500 (2.5초) | 2500 | LISTENING: 마지막 입력 후 무음 → 발화 종료 |
| `inactivityMs` | `VITE_INACTIVITY_MS` | 60000 (60초) | 8000 | 조작 화면 6곳: 무입력 → IDLE 복귀 |

값을 바꾼 뒤에는 개발 서버를 다시 시작해야 합니다 (`.env` 파일은 시작할 때 한 번 읽힙니다).

## 7. 실제 API로 교체하는 방법

1. `src/api/real/*.js`의 함수(`health`, `stt`, `resolve`, `route`, `getPois`, `createQr`)에 `fetch` 구현을 채웁니다. 함수 이름과 반환 형식은 `src/api/mock/*.js`와 같게 맞춥니다. 백엔드 응답 형식이 다르면 **이 파일 안에서 변환**합니다.
2. 실제 마이크는 `src/devices/realRecorder.js`에 `MediaRecorder`를 구현합니다. `start({ onSpeechEnd })` / `onInput` / `stop` / `checkMic` 인터페이스는 mock과 같습니다.
3. `.env.production`에서 `VITE_USE_MOCK=false`로 바꾸고 `VITE_API_BASE_URL=https://...`을 추가합니다.
4. `npm run build` 후 `npm run preview`로 확인합니다.

화면(`screens/`), reducer(`state/`), effect 핸들러(`effects/`)는 **손대지 않습니다**. 요청·응답 형식 중 백엔드와 합의가 필요한 항목은 [`docs/frontend-plan.md` 7절](../docs/frontend-plan.md#7-백엔드와-합의-필요)에 정리돼 있습니다.

## 8. 아직 정해지지 않은 사항

[`docs/frontend-plan.md` 6절](../docs/frontend-plan.md#6-결정-필요-사항)의 '미정' 항목입니다. 프로토타입에서는 괄호 안처럼 임시 처리했습니다.

- **손으로 고르기 목적지 목록**: 서버에서 받을지, 키오스크에 내장할지 (지금은 `api.getPois()` mock 호출. 내장으로 결정되면 상수로 교체)
- **QR 생성 주체**: 프론트에서 그릴지, 서버가 만들어 줄지 (지금은 `api.createQr()`이 URL을 돌려주고 화면에 글자로 표시. QR 이미지 라이브러리 보류)
- **ROUTE_GUIDE에서 2·3순위 경로 선택**과 휴대폰으로 보내지 않고 끝내는 방법 (지금은 2·3순위 표시만, 종료는 '처음으로'·무입력 복귀)
- **시작 점검에서 서버 불가와 마이크·STT 불가가 동시에 날 때** 우선순위 (지금은 서버 불가 우선)
- **CHECKING → STARTUP_CHECK** 점선의 의미 (지금은 30초 자동 재시도로 해석)
- **`/resolve` 응답 형식**, **`/stt` 입력 형식** (파일 업로드 vs 스트리밍) (mock은 `{ status, needConfirm, poi, candidates }`, `{ text }`로 가정)
- **마이크 mock 방식**은 임시로 텍스트 입력창을 씁니다. 실제 `MediaRecorder`는 `realRecorder.js` 자리만 있습니다.

## 9. 테스트

`npx vitest run`으로 돌아가는 것들입니다. 상태 머신·핸들러·recorder가 대상이고 화면 렌더링 테스트는 없습니다.

| 위치 | 내용 |
|---|---|
| `src/state/__tests__/` | 전이 표가 문서와 같은지(40항목, 상태 14, 이벤트 26), reducer의 failCount·세션 초기화 규칙 |
| `src/screens/__tests__/` | 화면 제목 14개가 상태 14개와 1:1인지, 오류 코드 → 사용자 문구 변환 |
| `src/effects/__tests__/` | 핸들러별로 API 응답 → 이벤트 변환, 타이머 만료·리셋, cleanup 뒤 dispatch 0회 (fake timers) |
| `src/devices/__tests__/` | mockRecorder의 무발화·무음 타이머, stop 후 콜백 없음 |

`inactivity.test.js`만 `document`가 필요해 파일 첫 줄의 `// @vitest-environment jsdom` 주석으로 jsdom을 켭니다. 나머지는 node 환경입니다.

`transitions.test.js`는 저장소의 `docs/kiosk-workflow.md`를 직접 읽어 코드와 대조하므로, `frontend/` 폴더만 따로 복사해 두면 그 테스트 하나가 "파일 없음"으로 실패합니다. 저장소 전체를 clone 한 상태에서 실행하세요.
