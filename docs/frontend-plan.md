# 키오스크 프론트엔드 프로토타입 구현 계획

- 작성일: 2026-11-09
- 기준 문서: `docs/kiosk-workflow.md` (화면 상태 12개 + 판단 노드 2개, 전이 41행 = 원본 26 + 2026-11-09 회의 추가 15)
- 기술 스택: Vite + React + JavaScript, 상태 관리 라이브러리 없이 `useReducer`
- 코드 위치: `frontend/` 안에만 작성

## 목표와 제약

- 백엔드·STT·LLM이 없으므로 **모든 API와 마이크를 mock으로** 대체하고, 화면 흐름(상태 전이)이 실제로 돌아가는지 확인하는 것이 목표
- 디자인은 최소. 큰 버튼 + 큰 글씨 정도만
- 나중에 실제 API로 교체하기 쉽도록 서버·장치 호출은 `src/api/`, `src/devices/` 두 곳에만 둔다
- 표에 없는 상태나 전이는 추가하지 않는다. 필요하면 문서를 먼저 고친다

## 확정된 결정

| 항목 | 결정 |
|---|---|
| IDLE 복귀 | `GO_HOME`('처음으로' 버튼, 조작 화면 7곳)·`INACTIVITY_TIMEOUT`(무입력 60초, 6곳)·`LISTEN_CANCEL`('취소')을 **정식 전이**로 표에 추가했다 (2026-11-09 회의). 개발자 패널의 `DEV_RESET`("처음부터")은 어느 상태에서든 초기값으로 되돌리는 **개발 도구**로 유지한다 |
| 판단 노드(`STARTUP_CHECK`, `FAIL_COUNT_CHECK`) | reducer 상태로 그대로 두고, 진입 즉시 effect가 조건을 판단해 다음 이벤트를 dispatch 한다. 전이 표 41행이 코드에 1:1로 옮겨진다 |
| 시간 설정값 | 무입력 60초, 무발화 10초, 재점검 60초, 서버 재시도 30초, 무음 2.5초는 `src/config.js`가 env(`VITE_*_MS`)에서 읽는다. 개발 중엔 `.env.development`에서 짧게 줄인다 |

2026-11-09 회의에서 확정된 나머지 항목(자동 녹음 없음, failCount 누적·초기화 규칙, LISTENING 10초 무발화, IDLE_REDUCED 재점검, RESOLVING→UNAVAILABLE 출발점)은 6절에 '확정'으로 표시했다.

## 1. frontend/ 폴더 구조

```
frontend/
  index.html                 # 진입 HTML (Vite 기본). 루트 div 하나.
  package.json               # 의존성·스크립트 (dev / build / test)
  vite.config.js             # Vite 설정 (React 플러그인)
  .env.development           # VITE_USE_MOCK=true + 타이머 단축값 (예: VITE_INACTIVITY_MS=10000)
  .env.production            # 당분간 VITE_USE_MOCK=true. 실제 API 준비 후 false로 바꾸고 VITE_API_BASE_URL 추가. 타이머는 운영값
  README.md                  # 실행 방법, mock 시나리오 키워드, 실제 API 교체 방법
  src/
    main.jsx                 # React를 DOM에 붙이는 진입점 (Spring의 main())
    App.jsx                  # Provider로 감싸고, 현재 상태에 맞는 화면을 고르는 라우터 역할
    config.js                # 시간 설정값. env(VITE_*_MS)를 읽고 없으면 운영 기본값 (Spring의 @ConfigurationProperties)
    state/                   # 상태 머신의 "설정 + 실행" (순수 로직, React 의존 최소)
      states.js              #   STATES 상수 14개 (문서 상태 이름 그대로)
      events.js              #   EVENTS 상수 26개 (문서 고유 이벤트, APP_START 제외) + 개발용 DEV_RESET
      transitions.js         #   { [state]: { [event]: nextState } } — 표 41행 중 APP_START를 뺀 40항목
      kioskReducer.js        #   initialState + reducer. transitions.js로 다음 상태를 찾고 payload를 저장
      KioskContext.jsx       #   createContext + Provider + useKiosk() 훅
    effects/                 # 상태 진입 시 실행되는 부수효과 (API 호출, 타이머)
      useKioskEffects.js     #   현재 상태를 보고 해당 핸들러 실행 → 결과를 dispatch
      handlers/              #   상태별 effect 함수 (startupCheck.js, checking.js, idleReduced.js, listening.js, resolving.js, failCountCheck.js, routing.js, inactivity.js)
    api/                     # 서버와 통신하는 유일한 곳
      index.js               #   VITE_USE_MOCK 보고 mock/real 중 하나를 export
      mock/                  #   mock 구현 (지연 시간 + 키워드 기반 시나리오)
        health.js, stt.js, resolve.js, route.js, pois.js, qr.js
        data/pois.js         #   가짜 목적지 목록
        data/routes.js       #   가짜 경로 3개
        mockDelay.js         #   공통 지연 헬퍼
      real/                  #   실제 구현 자리. 같은 함수 이름으로 fetch 호출. 지금은 "Not implemented" throw
        health.js, stt.js, resolve.js, route.js, pois.js, qr.js
    devices/                 # 브라우저 장치 추상화 (마이크). 서버가 아니라 장치이므로 api/와 분리
      recorder.js            #   mock/real 선택
      mockRecorder.js        #   텍스트 입력을 음성 대신 받고, 10초 무발화·2.5초 무음 타이머를 흉내
      realRecorder.js        #   MediaRecorder 사용 자리 (stub)
    screens/                 # 상태 하나 = 화면 하나 (아래 3절 표 참고)
    components/              # 화면이 공유하는 작은 부품
      BigButton.jsx, ScreenFrame.jsx, Spinner.jsx
      DevPanel.jsx           #   화면 구석의 개발자 패널 (현재 상태, failCount, 마지막 이벤트, 시나리오 선택, 처음부터 버튼)
    styles/
      global.css             # 큰 글씨·높은 대비 기본값만
```

## 2. 상태 관리 방식

### 2-1. 상수 (`state/states.js`, `state/events.js`)

- `STATES.IDLE = 'IDLE'` 식으로 문서 이름을 문자열 그대로 사용 → 개발자 패널과 문서를 눈으로 대조 가능
- `EVENTS`는 표의 **고유 이벤트 26종** (`MANUAL_SELECT_PRESSED` 4행, `GO_HOME` 7행, `INACTIVITY_TIMEOUT` 6행처럼 여러 행에 나와도 상수는 하나. `APP_START`는 dispatch 되지 않고 `initialState`로 표현하므로 제외)
- 표에 없는 것은 `DEV_RESET` 하나뿐이며 별도 `DEV_EVENTS` 객체로 분리해 "워크플로우가 아님"을 명시

개수 정리:

| 구분 | 개수 | 근거 |
|---|---|---|
| 표의 행 | 41 | 원본 26 + 2026-11-09 회의 추가 15 (`GO_HOME` 7, `INACTIVITY_TIMEOUT` 6, `LISTEN_CANCEL` 1, `RECHECK_TIMER` 1) |
| `initialState` | 1 | `[*] → STARTUP_CHECK (APP_START)` 행 |
| `transitions.js` 항목 | 40 | 41 − APP_START 1 |
| `EVENTS` 상수 | 26 | 고유 이벤트 27 − APP_START 1 (중복 행 제외: `MANUAL_SELECT_PRESSED` 3, `GO_HOME` 6, `INACTIVITY_TIMEOUT` 5). 이벤트 종류는 늘지 않음 |
| `STATES` 상수 | 14 | 화면 상태 12 + 판단 노드 2 (변동 없음) |

### 2-2. 전이 표 (`state/transitions.js`)

```js
export const transitions = {
  STARTUP_CHECK: { HEALTH_SERVER_DOWN: 'CHECKING', HEALTH_OK: 'IDLE', MIC_OR_STT_UNAVAILABLE: 'IDLE_REDUCED' },
  CHECKING:      { HEALTH_RETRY_TIMER: 'STARTUP_CHECK' },
  IDLE:          { MIC_BUTTON_PRESSED: 'LISTENING', MANUAL_SELECT_PRESSED: 'MANUAL_SELECT' },
  IDLE_REDUCED:  { MANUAL_SELECT_PRESSED: 'MANUAL_SELECT', RECHECK_TIMER: 'STARTUP_CHECK' },
  LISTENING:     { SPEECH_END: 'RESOLVING', LISTEN_CANCEL: 'IDLE', GO_HOME: 'IDLE' },
  // ... 표의 나머지 행 그대로 (총 40항목)
};
```

- 표의 `[*] → STARTUP_CHECK (APP_START)`는 `initialState.state = 'STARTUP_CHECK'`로 표현 (앱이 뜨면 바로 시작 점검)
- 표에 없는 조합이 dispatch 되면 reducer는 상태를 바꾸지 않고 `console.warn` 만 남긴다 → 잘못된 전이가 조용히 통과하지 않도록

### 2-3. reducer 상태 모양 (`state/kioskReducer.js`)

```js
{
  state: 'STARTUP_CHECK',   // 현재 상태 (문서 상태 이름)
  failCount: 0,             // 실패 횟수
  health: null,             // { server: bool, mic: bool, stt: bool }
  transcript: '',           // STT 결과 텍스트
  resolve: null,            // /resolve 응답 { status, needConfirm, poi, candidates }
  selectedPoi: null,        // 확정된 목적지
  routes: [],               // /route 응답 경로 최대 3개
  qr: null,                 // QR 데이터(URL 등)
  error: null,              // 마지막 오류 메시지 (UNAVAILABLE 화면 표시용)
  lastEvent: null,          // 개발자 패널 표시용
}
```

- reducer가 하는 일은 세 가지뿐: (1) `transitions[state][event]`로 다음 상태 결정 (2) 이벤트별 payload를 위 필드에 저장 (3) `failCount` 증감
  - `RESOLVE_NOT_UNDERSTOOD`, `CONFIRM_NONE_OF_THEM` → `failCount + 1` (누적)
  - `SWITCH_TO_VOICE` → `failCount = 0` (표 비고)
  - `IDLE` 로 들어가는 이벤트 `GO_HOME`, `INACTIVITY_TIMEOUT`, `LISTEN_CANCEL` → `failCount = 0` 과 함께 `transcript`, `resolve`, `selectedPoi`, `routes`, `qr`, `error` 도 비운다 (회의 확정. 새 사용자를 위한 초기화)
  - `DEV_RESET` → `initialState` (health 포함 전부 초기화, 개발 도구)
- API 호출·타이머는 reducer에 절대 두지 않는다 (Spring에서 `@Transactional` 서비스 메서드가 외부 HTTP를 직접 부르지 않는 것과 같은 원칙)
- **API 호출 위치 원칙**: 상태 전이를 일으키는 API 호출(`health`, `stt`, `resolve`, `route`)은 반드시 effect 핸들러에서만 한다. **예외**: 상태 전이를 일으키지 않는 표시용 조회(`getPois`, `createQr`)만 화면 컴포넌트가 직접 호출할 수 있다. 실패해도 화면에 오류 문구만 보여 주고 이벤트를 dispatch 하지 않는다

### 2-4. 연결 (`state/KioskContext.jsx`, `App.jsx`)

- `KioskProvider`가 `useReducer(kioskReducer, initialState)`를 들고 `{ state, dispatch }`를 Context로 제공
- 화면 컴포넌트는 `const { state, dispatch } = useKiosk()` 로 꺼내 쓴다
- `App.jsx`는 `SCREEN_BY_STATE[state.state]` 맵으로 화면 컴포넌트를 고른다 (라우팅 라이브러리 불필요. 키오스크는 URL이 없음)

### 2-5. 부수효과 (`effects/useKioskEffects.js`)

- `App` 안에서 한 번만 호출. 상태가 바뀔 때마다 해당 상태의 핸들러가 실행되고, 핸들러는 API 결과를 보고 **표에 있는 이벤트만** dispatch 한다

```js
useEffect(() => {
  const handler = HANDLERS[state.state];
  if (handler) return handler(state, dispatch, api, recorder); // cleanup 함수 반환 가능
}, [state.state]);
```

- 핸들러가 cleanup 함수를 반환하면 상태를 떠날 때 타이머·요청을 취소한다 (30초 재시도, 60초 재점검, 10초 무발화, 2.5초 무음, 60초 무입력 타이머 전부)
- 모든 시간값은 `src/config.js`에서 가져온다 (아래 "시간 설정값" 참고). 핸들러 안에 숫자를 직접 쓰지 않는다

| 상태 | 핸들러가 하는 일 | dispatch 하는 이벤트 | 예외 발생 시 |
|---|---|---|---|
| `STARTUP_CHECK` | `api.health()` + `recorder.checkMic()` | `HEALTH_OK` / `HEALTH_SERVER_DOWN` / `MIC_OR_STT_UNAVAILABLE` | `health()` throw → `HEALTH_SERVER_DOWN` |
| `CHECKING` | `config.healthRetryMs`(30초) 타이머 | `HEALTH_RETRY_TIMER` | 없음 (타이머만) |
| `IDLE_REDUCED` | `config.recheckMs`(60초) 타이머 → 재점검 | `RECHECK_TIMER` | 없음 (타이머만) |
| `LISTENING` | `recorder.start()` 로 **10초 무발화** 타이머와 **2.5초 무음** 타이머 가동 (아래 책임 분리 참고) | `SPEECH_END` (payload: `{ text }`; 10초 무발화면 `{ text: '' }`) | 없음 |
| `RESOLVING` | `api.stt(audio)` → `api.resolve(text)` | `RESOLVE_NEED_CONFIRM` / `RESOLVE_CONFIRMED` / `RESOLVE_NOT_UNDERSTOOD` / `RESOLVE_OUT_OF_SCOPE_OR_ERROR` | `stt()` 또는 `resolve()` throw → `RESOLVE_OUT_OF_SCOPE_OR_ERROR` |
| `FAIL_COUNT_CHECK` | `failCount` 확인 (동기) | `FAIL_COUNT_1` (failCount === 1) / `FAIL_COUNT_2` (>= 2) | 없음 (동기) |
| `ROUTING` | `api.route(poiId)` | `ROUTE_FOUND` / `ROUTE_FAILED` | `route()` throw → `ROUTE_FAILED` |
| `CONFIRMING`, `REASKING`, `UNAVAILABLE`, `MANUAL_SELECT`, `ROUTE_GUIDE`, `QR_HANDOFF` | 공통 `inactivity` 핸들러. `config.inactivityMs`(60초) 타이머. `document`의 `pointerdown`/`keydown` 이 오면 타이머 리셋 | `INACTIVITY_TIMEOUT` | 없음 (타이머만) |
| `IDLE` | 없음 (사용자 버튼이 이벤트를 낸다) | - | - |

- 판단 노드(`STARTUP_CHECK`, `FAIL_COUNT_CHECK`)는 화면 없이 `Spinner`를 잠깐 보여준다
- 무입력 타이머는 여섯 상태가 같은 핸들러 함수 하나를 공유한다 (`HANDLERS[CONFIRMING] = HANDLERS[REASKING] = HANDLERS[UNAVAILABLE] = ... = inactivityHandler`). 사용자가 조작하는 화면 중 `LISTENING`만 빠지는데, 거기서는 10초 무발화 타이머가 같은 역할을 하기 때문이다. 빈 텍스트로 `SPEECH_END`가 가는 10초 무발화는 `RESOLVING`에서 mock `resolve('')`가 `NOT_UNDERSTOOD`를 돌려주므로 기존 실패 흐름을 그대로 탄다

#### 시간 설정값 (`src/config.js`)

Spring의 `@ConfigurationProperties`처럼 env를 한 곳에서 읽어 기본값과 합친다. 핸들러와 recorder는 이 객체만 본다.

| 키 | env 변수 | 운영 기본값 | `.env.development` 권장값 | 쓰는 곳 |
|---|---|---|---|---|
| `healthRetryMs` | `VITE_HEALTH_RETRY_MS` | 30000 | 3000 | `CHECKING` |
| `recheckMs` | `VITE_RECHECK_MS` | 60000 | 5000 | `IDLE_REDUCED` |
| `noSpeechMs` | `VITE_NO_SPEECH_MS` | 10000 | 4000 | `LISTENING` (recorder) |
| `silenceMs` | `VITE_SILENCE_MS` | 2500 | 2500 | `LISTENING` (recorder) |
| `inactivityMs` | `VITE_INACTIVITY_MS` | 60000 | 8000 | 무입력 복귀 6개 상태 |

```js
// src/config.js
const num = (v, fallback) => (v === undefined ? fallback : Number(v));
export const config = {
  healthRetryMs: num(import.meta.env.VITE_HEALTH_RETRY_MS, 30000),
  recheckMs:     num(import.meta.env.VITE_RECHECK_MS, 60000),
  noSpeechMs:    num(import.meta.env.VITE_NO_SPEECH_MS, 10000),
  silenceMs:     num(import.meta.env.VITE_SILENCE_MS, 2500),
  inactivityMs:  num(import.meta.env.VITE_INACTIVITY_MS, 60000),
};
```

DevPanel에 현재 적용 중인 값을 표시해 "지금 몇 초로 돌고 있는지" 바로 볼 수 있게 한다.

#### StrictMode 대응 (비동기 핸들러 작성 규칙)

React 개발 모드의 `StrictMode`는 effect를 "실행 → cleanup → 다시 실행" 순으로 두 번 돌린다. 또 API 응답이 오기 전에 사용자가 상태를 바꿀 수도 있다. 그래서 모든 비동기 핸들러는 다음 규칙을 따른다 (Spring에 비유하면 `@Async` 메서드가 완료 전에 요청 컨텍스트가 닫혔는지 확인하는 것과 같다).

- 핸들러 안에 `let cancelled = false` 플래그를 두고, cleanup 함수에서 `cancelled = true`로 바꾼다
- 모든 `await` 뒤에는 `if (cancelled) return;` 을 넣어 **취소된 핸들러는 dispatch 하지 않는다**
- 타이머(`setTimeout`)는 cleanup에서 반드시 `clearTimeout` 한다

```js
// effects/handlers/routing.js
export function routingHandler(state, dispatch, api) {
  let cancelled = false;
  (async () => {
    try {
      const { routes } = await api.route(state.selectedPoi.id);
      if (cancelled) return;
      dispatch(routes.length ? { type: 'ROUTE_FOUND', routes } : { type: 'ROUTE_FAILED', error: '경로 없음' });
    } catch (e) {
      if (cancelled) return;
      dispatch({ type: 'ROUTE_FAILED', error: e.message });
    }
  })();
  return () => { cancelled = true; };
}
```

#### LISTENING 책임 분리

`LISTENING`은 여러 곳에서 끝날 수 있어 역할을 나눈다. `SPEECH_END`는 **먼저 끝나는 쪽이 `SPEECH_END({ text })`를 dispatch** 하고, 한 번 dispatch 되면 상태가 바뀌어 cleanup이 돌기 때문에 다른 쪽은 자연히 무효화된다. '취소'와 '처음으로'는 타이머와 무관하게 화면이 바로 dispatch 한다.

| 담당 | 책임 |
|---|---|
| `ListeningScreen` (화면) | 입력창(mock 음성), "다 말했어요", "취소", "처음으로" 버튼을 그린다. 입력이 바뀔 때마다 `recorder.onInput(text)`로 알린다. 버튼: 다 말했어요 → `SPEECH_END({ text })`, 취소 → `LISTEN_CANCEL`, 처음으로 → `GO_HOME` |
| `recorder` (장치) | 타이머 두 개를 관리한다. **무발화 타이머**: `start()` 직후 `config.noSpeechMs`(10초) 동안 `onInput`이 한 번도 오지 않으면 `onSpeechEnd({ text: '' })`. **무음 타이머**: 첫 `onInput` 이후부터 동작하며, `onInput`마다 리셋되고 `config.silenceMs`(2.5초) 동안 입력이 없으면 `onSpeechEnd({ text })`. 첫 입력이 오면 무발화 타이머는 해제한다. `stop()`에서 둘 다 clear |
| `LISTENING` 핸들러 (effect) | `recorder.start({ onSpeechEnd: ({ text }) => dispatch(SPEECH_END, { text }) })` 를 호출하고, cleanup에서 `recorder.stop()` |

빈 텍스트로 넘어간 `SPEECH_END`는 `RESOLVING`에서 `resolve('')` → `NOT_UNDERSTOOD` → `FAIL_COUNT_CHECK`로 이어져 기존 실패 흐름을 그대로 탄다 (회의 확정). `LISTEN_CANCEL`·`GO_HOME`은 둘 다 `IDLE`로 가고 failCount를 0으로 만든다. 버튼이 둘인 이유는 '취소'는 "말하기만 그만둔다"는 뜻이고 '처음으로'는 모든 조작 화면에 공통으로 두는 버튼이기 때문이다.

실제 마이크(`realRecorder.js`)로 바꿀 때는 `onInput` 대신 오디오 레벨로 발화·무음을 감지하고 `onSpeechEnd({ audio })`를 넘기면 되므로 화면·effect는 그대로다.

## 3. 화면 컴포넌트 목록 (상태 1 : 화면 1)

| 상태 | 파일 (`src/screens/`) | 화면 내용 (최소) | 버튼 → dispatch 이벤트 |
|---|---|---|---|
| `STARTUP_CHECK` | `StartupCheckScreen.jsx` | "점검 중..." 스피너 | 없음 (effect가 처리) |
| `CHECKING` | `CheckingScreen.jsx` | "서버 연결 중, 잠시 후 다시 시도" + 남은 초 | 없음 (타이머) |
| `IDLE` | `IdleScreen.jsx` | 안내 문구, 큰 마이크 버튼, 손으로 고르기 버튼 | `MIC_BUTTON_PRESSED`, `MANUAL_SELECT_PRESSED` |
| `IDLE_REDUCED` | `IdleReducedScreen.jsx` | 안내 문구, 손으로 고르기 버튼만 (마이크 숨김). 60초마다 자동 재점검 | `MANUAL_SELECT_PRESSED` (`RECHECK_TIMER`는 effect) |
| `LISTENING` | `ListeningScreen.jsx` | "듣고 있어요" + mock 입력창 + "다 말했어요" / "취소" / "처음으로" | `SPEECH_END` (버튼은 화면이 직접, 타이머는 recorder 경유), `LISTEN_CANCEL`, `GO_HOME` |
| `RESOLVING` | `ResolvingScreen.jsx` | "말씀 알아듣는 중..." 스피너 | 없음 |
| `CONFIRMING` | `ConfirmingScreen.jsx` | "OO 맞나요?" 또는 후보 목록, 예 / 모두 아니에요 / 다른 곳 말하기 / 처음으로. 자동 녹음 없음. 무입력 60초 복귀 | `DESTINATION_CONFIRMED`(poi), `CONFIRM_NONE_OF_THEM`, `CONFIRM_SAY_OTHER_PLACE`, `GO_HOME` (`INACTIVITY_TIMEOUT`은 effect) |
| `FAIL_COUNT_CHECK` | `FailCountCheckScreen.jsx` | 스피너 (즉시 지나감) | 없음 |
| `ROUTING` | `RoutingScreen.jsx` | "가는 길 찾는 중..." 스피너 | 없음 |
| `REASKING` | `ReaskingScreen.jsx` | "잘 못 알아들었어요, 다시 말씀해 주세요" + 다시 말하기 / 손으로 고르기 / 처음으로. 자동 녹음 없음. 무입력 60초 복귀 | `RETRY_SPEECH`, `MANUAL_SELECT_PRESSED`, `GO_HOME` (`INACTIVITY_TIMEOUT`은 effect) |
| `UNAVAILABLE` | `UnavailableScreen.jsx` | "안내해 드릴 수 없어요" + error 메시지 + 손으로 고르기 / 처음으로. 무입력 60초 복귀 | `MANUAL_SELECT_PRESSED`, `GO_HOME` (`INACTIVITY_TIMEOUT`은 effect) |
| `MANUAL_SELECT` | `ManualSelectScreen.jsx` | 목적지 큰 버튼 목록 (`api.getPois()`), 말로 하기 / 처음으로. 무입력 60초 복귀 | `POI_SELECTED`(poiId), `SWITCH_TO_VOICE`, `GO_HOME` (`INACTIVITY_TIMEOUT`은 effect) |
| `ROUTE_GUIDE` | `RouteGuideScreen.jsx` | 1순위 크게 + 2·3순위 작게, 휴대폰으로 보내기 / 처음으로. 무입력 60초 복귀 | `SEND_TO_PHONE_PRESSED`, `GO_HOME` (`INACTIVITY_TIMEOUT`은 effect) |
| `QR_HANDOFF` | `QrHandoffScreen.jsx` | QR 자리(텍스트/URL) 표시 + 처음으로. 무입력 60초 복귀 | `GO_HOME` (`INACTIVITY_TIMEOUT`은 effect) |

- '처음으로' 버튼은 `ScreenFrame`의 `showHome` prop으로 넣는다. 사용자가 조작하는 7개 화면(`LISTENING`, `CONFIRMING`, `REASKING`, `UNAVAILABLE`, `MANUAL_SELECT`, `ROUTE_GUIDE`, `QR_HANDOFF`)만 `showHome`을 켠다. 스피너 화면 5개와 `IDLE`, `IDLE_REDUCED`는 끈다
- 공통 부품: `ScreenFrame` (제목 + 본문 + 버튼 영역 + 선택적 '처음으로'), `BigButton`. 디자인은 글씨 크기·여백만
- `ManualSelectScreen`의 목적지 목록은 "미정"이지만 교체가 쉽도록 `api.getPois()`로 받는다 (내장으로 결정되면 mock을 상수로 바꾸면 끝)

## 4. mock API 함수 목록 (`src/api/mock/`)

모든 함수는 `Promise`를 반환하고 300~800ms 지연을 둔다 (실제 네트워크 느낌 + 스피너 확인용). 실패 시 `Error`를 throw 하며 effect 핸들러가 이를 이벤트로 바꾼다. 실패 케이스는 **입력 텍스트의 키워드**로 유발한다 (DevPanel 시나리오 선택으로도 강제 가능).

| 함수 | 입력 | 출력 (성공) | 실패/분기 케이스 |
|---|---|---|---|
| `health()` | 없음 | `{ server: true, stt: true }` | DevPanel 시나리오 `serverDown` → `{ server: false }`; `sttDown` → `{ server: true, stt: false }` |
| `stt(audio)` | `{ text }` (mockRecorder가 텍스트를 담아 줌) | `{ text }` 그대로 | 입력 텍스트가 `"에러"` 포함 → `Error('STT_ERROR')`; 빈 문자열 → `{ text: '' }` |
| `resolve(text)` | 문자열 | `{ status: 'OK', needConfirm: false, poi }` 또는 `{ status: 'OK', needConfirm: true, candidates: [poi, ...] }` | `""`/`"웅얼"` → `{ status: 'NOT_UNDERSTOOD' }`; `"하와이"` → `{ status: 'OUT_OF_SCOPE' }`; `"에러"` → `Error('SERVER_ERROR')`; `"병원"` → needConfirm=true 후보 3개; 목적지 이름 정확히 → needConfirm=false |
| `route(poiId)` | 문자열 | `{ routes: [1순위, 2순위, 3순위] }` | `poiId === 'poi-no-route'` → `{ routes: [] }`; 시나리오 `routeError` → `Error('ROUTE_ERROR')` |
| `getPois()` | 없음 | `[{ id, name, category }]` 10개 내외 | 시나리오 `poisError` → `Error` (화면에 "목록을 불러올 수 없어요" 표시, 전이 없음) |
| `createQr(routeId)` | 문자열 | `{ url: 'https://example/r/...' }` | 시나리오 `qrError` → `Error` (QR 화면에 오류 문구, 전이 없음) |

장치 mock (`src/devices/mockRecorder.js`):

| 함수 | 입력 | 출력 | 실패 케이스 |
|---|---|---|---|
| `checkMic()` | 없음 | `{ available: true }` | 시나리오 `micDown` → `{ available: false }` |
| `start({ onSpeechEnd })` | 콜백 | 무발화 타이머(`config.noSpeechMs`, 10초) 가동. 입력 없이 만료되면 `onSpeechEnd({ text: '' })`. 첫 `onInput` 이후엔 무음 타이머(`config.silenceMs`, 2.5초)로 전환되어 마지막 입력 후 2.5초가 지나면 `onSpeechEnd({ text })` | 없음 |
| `onInput(text)` | 현재 입력 텍스트 | 무발화 타이머 해제(첫 입력 시), 무음 타이머 리셋, 텍스트 보관 | 없음 |
| `stop()` | 없음 | 타이머 둘 다 clear | 없음 |

("다 말했어요", "취소", "처음으로" 버튼은 recorder를 거치지 않고 `ListeningScreen`이 직접 dispatch 한다. 2-5절 책임 분리 참고.)

`src/api/index.js`:

```js
import * as mock from './mock';
import * as real from './real';
export const api = import.meta.env.VITE_USE_MOCK === 'true' ? mock : real;
```

→ 실제 API 교체 = `real/*.js`에 `fetch` 구현을 채우고 `.env`만 바꾸면 된다. 화면·reducer·effect는 손대지 않는다.

환경 파일은 둘 다 당분간 `VITE_USE_MOCK=true`로 둔다. 빌드 결과물(`npm run build`)도 mock으로 돌아가야 시연이 가능하기 때문이다. 실제 API가 준비되면 `.env.production`만 `VITE_USE_MOCK=false`로 바꾸고 `VITE_API_BASE_URL`을 추가한다.

## 5. 구현 순서

### Phase 2 — 뼈대 + 상태 머신 (API 없음)

1. `npm create vite@latest frontend -- --template react` 로 생성, 불필요한 샘플 제거
2. Vitest 설치 (`npm install -D vitest`, `package.json`에 `"test": "vitest"` 추가). Spring의 JUnit 자리
3. `config.js`, `states.js`, `events.js`, `transitions.js` (40항목), `kioskReducer.js`, `KioskContext.jsx`
4. 전이 표·reducer 테스트 (`src/state/__tests__/`)
   - `transitions.js` 항목 총합이 40이고, 모든 키가 `STATES`에, 모든 이벤트가 `EVENTS`에 있는지
   - `STATES`가 14개, `EVENTS`가 26개인지
   - `GO_HOME`이 정확히 7개 상태에, `INACTIVITY_TIMEOUT`이 정확히 6개 상태에 있고 모두 `IDLE`로 가는지
   - reducer: `RESOLVE_NOT_UNDERSTOOD`·`CONFIRM_NONE_OF_THEM`에서 failCount +1, `SWITCH_TO_VOICE`·`GO_HOME`·`INACTIVITY_TIMEOUT`·`LISTEN_CANCEL`에서 0, `DEV_RESET`에서 `initialState`
   - 표에 없는 조합은 상태를 바꾸지 않는지
5. 14개 화면을 플레이스홀더로 생성: 상태 이름 + 표에 있는 버튼만('처음으로'·'취소' 포함). 버튼은 `dispatch` 직접 호출
6. `App.jsx` 화면 선택 + `DevPanel` (현재 상태, failCount, 마지막 이벤트, 적용 중인 시간 설정값, 처음부터 버튼)
7. **effect 없이** 판단 노드·자동 전이·타이머 이벤트도 DevPanel 버튼으로 수동 dispatch 해 40항목 전부를 클릭으로 확인

완료 기준: `npm test` 통과, 모든 항목을 손으로 눌러 지나갈 수 있고, 표에 없는 조합은 `console.warn`

### Phase 3 — mock API 계층 + 시작 점검

1. `api/mock/*`, `api/real/*`(stub), `api/index.js`, `mockDelay.js`, `.env.development`
2. `devices/recorder.js` + `mockRecorder.js` (`checkMic`만 먼저)
3. `useKioskEffects.js` + `STARTUP_CHECK`, `CHECKING`, `IDLE_REDUCED` 핸들러 (시간값은 `config.js`, `.env.development`에서 단축)
4. DevPanel 시나리오 선택 (`serverDown`, `sttDown`, `micDown`) 추가

완료 기준: 앱 시작 → IDLE / IDLE_REDUCED / CHECKING 세 갈래 모두 재현. `IDLE_REDUCED`에서 시나리오를 정상으로 바꾸면 재점검 타이머 후 `IDLE`로 회복

### Phase 4 — 음성 경로

1. `mockRecorder.start/onInput/stop` (10초 무발화 타이머 + 2.5초 무음 타이머)
2. `ListeningScreen` 버튼 3개 (다 말했어요 / 취소 / 처음으로)
3. `LISTENING`, `RESOLVING`, `FAIL_COUNT_CHECK` 핸들러
4. `ConfirmingScreen` 후보 표시, `ReaskingScreen` (둘 다 버튼만, 자동 녹음 없음)
5. 공통 `inactivity` 핸들러를 먼저 만들어 `CONFIRMING`, `REASKING`에 연결 (Phase 5에서 나머지 4개 상태에 재사용)

완료 기준: 키워드로 need_confirm / 즉시 확정 / 못 알아들음 1회→REASKING / 2회→MANUAL_SELECT / 범위 밖→UNAVAILABLE 재현. 추가로 10초 무발화 → 빈 텍스트 → REASKING, '취소' → IDLE(failCount 0), '처음으로' → IDLE, CONFIRMING·REASKING 무입력 → IDLE 재현

### Phase 5 — 경로·수동 선택·QR

1. `ROUTING` 핸들러, `RouteGuideScreen` (1순위 크게, 3개)
2. `ManualSelectScreen` (`getPois`) → `POI_SELECTED` → ROUTING, `SWITCH_TO_VOICE`로 failCount 초기화 확인
3. `QrHandoffScreen` (`createQr`, 텍스트 URL로 표시. QR 이미지 라이브러리는 미정 해결 후)
4. Phase 4의 `inactivity` 핸들러를 `UNAVAILABLE`, `MANUAL_SELECT`, `ROUTE_GUIDE`, `QR_HANDOFF`에도 연결 (총 6개 상태). 터치·키 입력 시 타이머 리셋 확인
5. `ScreenFrame`의 `showHome`으로 '처음으로' 버튼을 조작 화면 7곳에만 노출

완료 기준: 경로 있음/없음/오류, poi 직행, QR 화면까지 끝. 여섯 상태 모두 무입력 타이머 만료 시 IDLE로 복귀하고 failCount가 0이 됨. 화면을 터치하면 타이머가 리셋됨

### Phase 6 — 마무리

1. `global.css` 최소 고령자 UI (글씨 28px 이상, 버튼 높이 80px 이상, 고대비)
2. effect 핸들러 테스트 추가 (Vitest, fake timers): mock API를 주입해 `RESOLVING`·`ROUTING` 핸들러가 성공·실패·예외 각각에서 올바른 이벤트를 dispatch 하는지, cleanup 뒤에는 dispatch 하지 않는지(StrictMode 규칙). 타이머 핸들러(`inactivity`, `IDLE_REDUCED`, recorder 10초/2.5초)가 설정값대로 발화하고 cleanup에서 멈추는지
3. `frontend/README.md`: 실행 방법(`npm install`, `npm run dev`, `npm test`), mock 키워드 목록, 시간 설정값 env 목록, 실제 API 교체 절차
4. 문서 대조: `docs/kiosk-workflow.md` 41행과 `initialState` 1 + `transitions.js` 40항목을 한 번 더 비교

## 6. 결정 필요 사항

'확정'으로 표시한 항목은 2026-11-09 팀 회의에서 결정되어 `docs/kiosk-workflow.md`에 반영됐다. 나머지는 프로토타입에서 "임시 처리"로 진행한다.

| # | 항목 | 출처 | 상태 | 처리 |
|---|---|---|---|---|
| 1 | `MANUAL_SELECT` 목적지 목록: 서버 vs 내장 | 표 미정 5건 | 미정 | `api.getPois()`로 mock 호출. 내장으로 결정되면 상수로 교체 |
| 2 | QR 생성: 프론트 vs 서버 | 표 미정 | 미정 | `api.createQr()` mock이 URL 반환, 화면엔 텍스트로 표시. QR 이미지 라이브러리 도입 보류 |
| 3 | `CONFIRMING`의 "자동 녹음" 처리 | 표 미정 + 확인 필요 10 | **확정** | 자동 녹음 없음. 버튼(예 / 모두 아니에요 / 다른 곳 말하기 / 처음으로)으로만 진행. `CONFIRMING → RESOLVING` 전이 없음 |
| 4 | `REASKING`의 "자동 녹음" | 확인 필요 10 | **확정** | 자동 녹음 없음. 버튼(`RETRY_SPEECH` / `MANUAL_SELECT_PRESSED` / `GO_HOME`)으로만 |
| 5 | `LISTENING` 탈출 조건 | 확인 필요 6 | **확정** | 진입 후 10초 무발화면 빈 텍스트로 `SPEECH_END` → 기존 NOT_UNDERSTOOD 흐름. 입력 시작 후엔 발화 후 2.5초 무음. '취소'(`LISTEN_CANCEL`) → IDLE. 시간값은 설정 |
| 6 | 실패 횟수 초기화 시점과 누적 여부 | 확인 필요 7 | **확정** | 누적. 1회 → REASKING, 2회 이상 → MANUAL_SELECT. `IDLE` 진입(`INACTIVITY_TIMEOUT`, `GO_HOME`, `LISTEN_CANCEL`) 시 0. `SWITCH_TO_VOICE` 초기화 유지 |
| 7 | 끝 상태·조작 화면에서 `IDLE` 복귀 | 확인 필요 8 | **확정** | `CONFIRMING`, `REASKING`, `UNAVAILABLE`, `MANUAL_SELECT`, `ROUTE_GUIDE`, `QR_HANDOFF` 6곳에서 무입력 60초 → `INACTIVITY_TIMEOUT` (사용자가 자리를 떠나도 키오스크가 멈추지 않도록). 조작 화면 7곳에 '처음으로' → `GO_HOME`. `LISTENING`은 10초 무발화와 '취소'가 대신함. `DEV_RESET`은 개발 도구로 유지 |
| 8 | `ROUTE_GUIDE`에서 2·3순위 경로 선택, 휴대폰으로 보내지 않고 종료 | 확인 필요 9 | 미정 | 2·3순위는 표시만, 선택 불가. 종료는 '처음으로'·무입력 복귀로 대체 |
| 9 | 시작 점검에서 "서버 불가"와 "마이크·STT 불가" 동시 발생 시 우선순위 | 확인 필요 4 | 미정 | 서버 불가 우선 (서버 없으면 아무것도 못 하므로) |
| 10 | `IDLE_REDUCED` 복구 경로 | 확인 필요 5 | **확정** | 60초마다 `RECHECK_TIMER` → `STARTUP_CHECK`에서 다시 점검. 정상이면 `IDLE`. 시간값은 설정 |
| 11 | `CHECKING → STARTUP_CHECK` 점선의 의미 | 확인 필요 1 | 미정 | 30초 자동 재시도 타이머로 해석 |
| 12 | `RESOLVING → UNAVAILABLE` 출발점 | 확인 필요 2 | **확정** | `RESOLVING`(3-1)에서 출발 |
| 13 | `/resolve` 응답 형식 | 백엔드 미정 (7절 참고) | 미정 | mock에서 `{ status, needConfirm, poi, candidates }`로 가정 |
| 14 | `/stt` 입력 형식 (파일 업로드 vs 스트리밍) | 백엔드 미정 (7절 참고) | 미정 | mock은 `{ text }` 객체 |
| 15 | 마이크 mock 방식 | 프로토타입 | 임시 | 텍스트 입력창으로 음성 대체. 실제 `MediaRecorder`는 `realRecorder.js` 자리만 |
| 16 | 시간 설정값 (무입력 60초, 무발화 10초, 재점검 60초) | 회의 | **확정** | `src/config.js`가 env에서 읽음. 개발 중엔 `.env.development`에서 단축 |

## 7. 백엔드와 합의 필요

mock이 가정하고 있는 요청·응답 형식이다. 백엔드 확정 후 달라지면 `src/api/real/*.js` 안에서 변환하고, 화면·reducer는 바꾸지 않는 것이 목표다.

| 엔드포인트 | 프론트가 가정한 요청 | 프론트가 가정한 응답 | 합의할 것 |
|---|---|---|---|
| `GET /health` | 없음 | `{ server: bool, stt: bool }` | STT 가용 여부를 `/health`가 알려주는지, 별도 엔드포인트인지 |
| `POST /stt` | 녹음 파일 (`FormData`, Blob) | `{ text: string }` | 파일 포맷(webm/wav), 스트리밍 여부, 빈 음성일 때 응답 |
| `POST /resolve` | `{ text: string }` | `{ status: 'OK' \| 'NOT_UNDERSTOOD' \| 'OUT_OF_SCOPE', needConfirm: bool, poi?: Poi, candidates?: Poi[] }` | "못 알아들음"과 "범위 밖"을 구분하는 필드, 후보 최대 개수, `Poi` 구조(`id`, `name`, `category`) |
| `POST /route` 또는 `GET /route?poi_id=` | `{ poiId: string }` | `{ routes: Route[] }` (최대 3개, 1순위가 첫 번째) | `Route` 구조(소요 시간, 환승, 요약 문구), 경로 없음을 빈 배열로 주는지 오류로 주는지 |
| `GET /pois` (가정) | 없음 | `Poi[]` | 손으로 고르기 목록을 서버에서 주는지, 키오스크에 내장하는지 (6절 1번) |
| `POST /qr` (가정) | `{ routeId: string }` | `{ url: string }` | QR을 서버가 만드는지, 프론트가 URL로 직접 그리는지 (6절 2번) |
| 공통 | - | - | 오류 응답 형식(HTTP 상태 코드 + `{ message }`), 타임아웃 기준, 연결 끊김을 프론트가 어떻게 감지할지 |

## 검증 방법

1. `cd frontend && npm install && npm run dev` → 브라우저 `http://localhost:5173`
2. 개발자 패널을 보면서 아래 시나리오를 키워드로 재현
   - 정상: 시작 → IDLE → 마이크 → "서울역" → ROUTING → ROUTE_GUIDE → 휴대폰으로 보내기 → QR_HANDOFF
   - 확인: "병원" → CONFIRMING → 후보 선택 → ROUTE_GUIDE
   - 실패 1회: "웅얼" → REASKING → 다시 말하기 → "웅얼" → MANUAL_SELECT (failCount 2)
   - 범위 밖: "하와이" → UNAVAILABLE → 손으로 고르기
   - 시나리오 `serverDown` → CHECKING → 타이머 → 재점검; `micDown` → IDLE_REDUCED
   - 경로 없음 poi 선택 → UNAVAILABLE
   - 무입력 복귀: CONFIRMING / REASKING / UNAVAILABLE / MANUAL_SELECT / ROUTE_GUIDE / QR_HANDOFF 여섯 화면 각각에서 아무것도 안 누르고 설정 시간 대기 → IDLE, failCount 0. 중간에 화면을 터치하면 타이머가 다시 시작되는지 확인. 특히 "병원" → CONFIRMING 방치, "웅얼" → REASKING 방치 두 경우를 확인
   - 처음으로: 조작 화면 7곳에서 '처음으로' → IDLE, failCount 0. 스피너 화면과 IDLE에는 버튼이 없는지 확인
   - LISTENING 취소: 마이크 → '취소' → IDLE. 실패 1회 뒤 다시 말하기 → '취소' → failCount 0 확인
   - LISTENING 무발화: 마이크 → 아무 입력 없이 설정 시간 대기 → RESOLVING → REASKING (빈 텍스트 → NOT_UNDERSTOOD)
   - IDLE_REDUCED 재점검: `micDown` → IDLE_REDUCED → DevPanel에서 시나리오를 정상으로 → 재점검 타이머 후 STARTUP_CHECK → IDLE
3. `npm test` 로 전이 표 40항목·상수 개수(STATES 14, EVENTS 26)·GO_HOME 7곳·INACTIVITY_TIMEOUT 6곳·failCount·핸들러·타이머 테스트 통과
4. 콘솔에 "표에 없는 전이" 경고가 뜨지 않는지 확인
5. 개발 모드(StrictMode)에서 `RESOLVING`, `ROUTING` 을 지날 때 이벤트가 두 번 dispatch 되지 않는지 DevPanel의 마지막 이벤트 기록으로 확인
