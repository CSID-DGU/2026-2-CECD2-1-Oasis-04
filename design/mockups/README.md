# 시안 (design/mockups)

## 폴더 구조 (2026-11-17 정리)

| 폴더 | 기준 | 들어 있는 것 |
|---|---|---|
| `confirmed/` | 확정된 시안. 팀장 결정이 난 것만 둔다 | IDLE 세 가지(`idle-final-subway.html`, `idle-final-bus.html`, `idle-final-default.html`), IDLE_REDUCED(`idle-reduced-final.html`), 얇은 띠(`band-thin.html`), 그 스타일과 띠 부품(`idle-final.css`, `idle-band.js`), LISTENING(`listening-final.html`), 기다림 화면 5개(`wait-final.html`, `wait.css`, 찍기 `wait-shoot.sh`), ROUTE_GUIDE(`route-guide-final.html`, 시험 데이터 `route-cases.js`, 찍기 `route-shoot.sh`), CONFIRMING(`confirming-final.html`)·MANUAL_SELECT(`manual-select-final.html`)와 두 화면의 고르는 카드·남은 시간 알림(`pick.css`, `timeout-notice.js`, 찍기 `pick-shoot.sh`, 2026-11-18), REASKING(`reasking-final.html`)·UNAVAILABLE(`unavailable-final.html`)·QR_HANDOFF(`qr-handoff-final.html`)와 MANUAL_SELECT 불러오는 중·오류(`manual-select-final.html?state=loading|error`), 네 화면의 공통 스타일(`states.css`, 찍기 `states-shoot.sh`, 2026-11-19), 모아 보기(`overview.html`, 상태 14개 모두), 확정 스크린샷(`shots/`) |
| `wip/` | 작성 중인 시안. 아직 결정 전 | 시연(`demo.html`, 확정본만 쓴다: IDLE → LISTENING → RESOLVING → ROUTING → ROUTE_GUIDE) |
| `archive/` | 폐기했거나 제안으로 끝난 시안, 확정안을 만들어 온 과정 | 방향 A·B·C(`a.html`, `b.html`, `c.html`, `index.html`), v2~v10, 만들기·찍기 스크립트(`build-*.mjs`, `*-shoot.sh`), 그때의 스크린샷(`shots/`) |
| `shared/` | 세 폴더가 함께 쓰는 것 | `base.css`(실제 앱의 `global.css` 를 불러온다), `flow.css`(IDLE 다음 화면들의 공통 틀: 얇은 띠, 좌우 칸, 버튼, 고리), `brand.js`(서비스 이름. 이 한 곳만 고친다), `mock.js`(화면 하나만 보이기, 하한선 검사), `v3.js`(시각·날짜), `derive.html`(흐림·흑백 변환), `flow-compare.html`(스크린샷 나란히 놓기), `icons/` |

- 시안이 확정되면 `wip/` 에서 `confirmed/` 로, 버리면 `archive/` 로 옮긴다. 옮길 때 다른 폴더의 파일을 가리키는 경로(`../shared/`, `../confirmed/`)를 함께 확인한다
- `confirmed/` 의 IDLE 파일은 `archive/build-final.mjs` 가 v8·v10 원본에서 만든다 (`archive/` 폴더에서 `node build-final.mjs`). 직접 고치지 않는다. 다시 찍기는 `confirmed/` 에서 `bash idle-shoot.sh`
- 서비스 이름은 `shared/brand.js` 의 `SERVICE_NAME` 한 곳에서 바꾼다 (2026-11-17, "말길" → "오아시스"). 화면에는 이름 자리 `<service-name></service-name>` 만 두고 `<head>` 에서 `brand.js` 를 불러온다. IDLE 파일은 `build-final.mjs` 가 원본의 이름을 이 자리로 바꿔 넣는다. `archive/` 의 지난 시안은 "말길" 그대로 두었다
- 스크립트는 자기 폴더에서 실행한다: `confirmed/` 에서 `bash route-shoot.sh`, `bash wait-shoot.sh`, `bash pick-shoot.sh`(이름 앞부분을 주면 그 화면만: `bash pick-shoot.sh confirming`), `archive/` 에서 `bash v8-shoot.sh` 등
- `confirmed/band-thin.html` 은 얇은 띠 확정 때의 예시라 고치지 않고 둔다. **띠 모양만 참고하고, 목록 배치는 `manual-select-final.html` 을 따른다** (band-thin 은 왼쪽 칸이 x 48px·한 칸 373px 인 예전 배치다. 지금은 x 140px·한 칸 343px, 디자인 문서 6절. 2026-11-18)
- 시안 주소: `confirming-final.html`(후보 3개), `?n=1`(후보 1개), `?names=long`(긴 이름 시험), `manual-select-final.html`, `?voice=0`(말로 하기 숨김), `?names=long`, `?lines=1`(카드 이름 줄 수를 제목에 적음). `manual-select-final.html?state=loading | error`(불러오는 중·목록 오류), `reasking-final.html?heard=`(들은 말 없음), `unavailable-final.html?r=noroute | close | scope | upstream | generic`(이유 5가지, 그 밖의 드문 이유는 파일의 REASONS), `qr-handoff-final.html`. 모든 무입력 화면에서 `?left=15` 는 남은 시간 알림, `&live=1` 을 더하면 1초씩 줄어든다
- **아래 기록은 만든 순서대로 적은 것이다.** 폴더 표시 없이 적힌 파일 이름은 따로 적지 않았으면 `archive/` 에 있다 (`base.css`, `mock.js`, `derive.html`, `icons/` 는 `shared/`. `idle-final-*`, `idle-reduced-final`, `band-thin`, `idle-final.css`, `idle-band.js` 는 `confirmed/`)

## 시안: 디자인 방향 세 가지 (2026-11-16) — archive/

`design/audit.md` 의 공통 문제 3번(읽을 것과 누를 것이 멀다), 4번(기다림 화면), 5번(핵심이 작다)을 서로 다른 방법으로 푼 시안이다.
`frontend/` 코드와 `docs/design-guidelines.md` 는 고치지 않았다. 방향이 정해지면 문서를 먼저 고친다.
**어느 방향으로 갈지는 아직 정하지 않았다.**

## 보는 방법

- `index.html` 을 브라우저로 연다. 가로는 방향(A·B·C), 세로는 화면 4개(`IDLE`, `LISTENING`, `ROUTING`, `ROUTE_GUIDE`). 위쪽 버튼으로 원본 / 흑백 / 축소를 바꾼다
- 움직임(기다림·듣는 중)은 시안 페이지를 직접 열어야 보인다: `a.html?s=IDLE` (화면 이름을 바꿔 가며)
- 시안 페이지에는 `CHECKING`, `MANUAL_SELECT` 도 있다. 비교표의 12장에는 넣지 않았다

## 세 방향

| | 읽을 것과 누를 것을 붙이는 방법 | 버튼 위치 | 핵심을 키우는 방법 |
|---|---|---|---|
| A. 공공 안내형 | 내용이 버튼 쪽으로 내려온다 | 모든 버튼이 늘 맨 아래 | 화면 제목을 36px 로 내리고 핵심이 48px |
| B. 카드형 | 주 버튼이 내용 카드 안으로 올라간다 | 주 버튼은 카드 안, 나가는 버튼은 맨 아래 | 크기는 그대로, 강조 배경 카드로 |
| C. 큰 단계형 | 내용과 버튼이 화면 가운데에서 만난다 | 모든 버튼이 핵심 바로 아래 | 네 번째 글씨 단계 72px |

시안 전에 정한 것 (팀장, 2026-11-16): 72px 는 시안에서만 써 본다 / A 의 위쪽 띠는 위치만(시각 없음) / B 의 아이콘은 Material Symbols / 움직임은 기다림·듣는 중의 반복 움직임만, 화면 전환 효과 없음.

## 하한선 검사 (12장)

재는 방법: `<방향>.html?s=<화면>&measure=1` (`mock.js`). 브라우저가 계산한 글씨 크기·버튼 높이·글씨색과 그 뒤 배경색을 읽는다. 결과 원본은 `shots/measure.txt`.

| 방향 | 화면 | 글씨 (개수 / 가장 작은 것) | 30px 미만 | 버튼 (개수 / 가장 낮은 것) | 112px 미만 | 허용 조합 밖의 글씨·배경 |
|---|---|---|---|---|---|---|
| A | `IDLE` | 6 / 30px | 0 | 2 / 112px | 0 | 0 |
| A | `LISTENING` | 8 / 30px | 0 | 3 / 112px | 0 | 0 |
| A | `ROUTING` | 7 / 30px | 0 | 버튼 없음 | 0 | 0 |
| A | `ROUTE_GUIDE` | 14 / 30px | 0 | 2 / 112px | 0 | 0 |
| B | `IDLE` | 5 / 36px | 0 | 2 / 112px | 0 | 0 |
| B | `LISTENING` | 6 / 30px | 0 | 3 / 112px | 0 | 0 |
| B | `ROUTING` | 2 / 36px | 0 | 버튼 없음 | 0 | 0 |
| B | `ROUTE_GUIDE` | 11 / 30px | 0 | 2 / 112px | 0 | 0 |
| C | `IDLE` | 5 / 36px | 0 | 2 / 112px | 0 | 0 |
| C | `LISTENING` | 6 / 30px | 0 | 3 / 112px | 0 | 0 |
| C | `ROUTING` | 2 / 36px | 0 | 버튼 없음 | 0 | 0 |
| C | `ROUTE_GUIDE` | 9 / 30px | 0 | 2 / 112px | 0 | 0 |

어긴 곳이 없어서 고친 것도 없다. 12장에 쓰인 글씨·배경 조합은 7가지이고 모두 디자인 문서 3-2절 표에 있다:
본문 `#111111` 위 흰색·묶음·강조 / 보조 `#444444` 위 흰색·묶음·강조 / 흰색 위 주 버튼 `#0A4A9F`.

이 검사가 보지 않는 것:
- 글씨가 아닌 것의 색: B 의 카드 테두리(`#444444`), 아이콘(옆 글자와 같은 색), A 의 점과 C 의 고리(본문색이 흐려졌다 진해지는 움직임)
- C 의 72px 는 30px 이상이라 통과하지만 "글씨 단계는 세 개뿐"(문서 3-3절)에는 없는 값이다. 시안에서만 쓰기로 한 것이다

## 비교표

스크린샷(원본·흑백·축소)에서 본 것만 적었다. 결론은 내리지 않는다.

| | A. 공공 안내형 | B. 카드형 | C. 큰 단계형 |
|---|---|---|---|
| **첫눈에** (3초 안에 다음에 누를 것이 보이는가) | 파란 버튼이 하나뿐이고 늘 화면 아래 같은 자리, 읽을 글 바로 아래에 있다. 화면 위쪽 절반 이상이 비어 있어 눈이 아래로 내려가야 한다. `ROUTING` 은 누를 것이 없고 단계 띠와 점 세 개가 맨 아래에 있다 | 파란 버튼이 화면 위쪽 카드 안에 있어 제목 다음에 바로 보인다. 나가는 버튼은 맨 아래에 떨어져 있어 누를 곳이 위아래 두 군데다. `ROUTING` 은 누를 것이 없고 카드 안에 막대가 있다 | 파란 버튼이 화면 가운데, 가장 큰 글씨 바로 아래에 있다. `IDLE`·`LISTENING` 에서 가장 큰 것은 버튼이 아니라 마이크 그림이다. `ROUTING` 은 누를 것이 없고 가운데에 그림과 큰 글씨만 있다 |
| **멀리서** (축소본에서 제목과 주 버튼이 읽히는가) | 핵심 줄(48px)은 읽힌다. 36px 로 내린 화면 제목("말씀해 주세요", "이렇게 가세요")은 가장 작게 보여 읽기 어렵다. 주 버튼은 파란 띠로 보이고 글자는 겨우 읽힌다 | 제목(48px)은 읽힌다. 주 버튼은 파란 띠로 보이고 글자는 겨우 읽힌다. 아이콘은 점처럼 보여 무슨 그림인지 알 수 없다 | 가장 큰 줄(72px)이 세 방향 중 가장 잘 읽힌다. 작게 올린 제목(36px)은 읽기 어렵다. 주 버튼은 파란 띠로 보이고 글자는 겨우 읽힌다. 마이크·길 그림은 축소본에서도 알아볼 수 있다 |
| **흑백** (흑백에서 주 버튼과 노선이 구분되는가) | 주 버튼은 짙은 회색 채움, 보조는 흰 바탕 + 테두리라 구분된다. 1순위 경로 줄의 강조 배경이 위쪽 띠와 같은 옅은 회색이 되지만 위아래 선과 큰 글씨로 구분된다 | 주 버튼은 구분된다. 강조 배경 카드가 화면 바탕과 같은 회색이 되어 1순위 카드가 바탕에 묻히고 테두리만 남는다(흰 카드인 2·3순위가 오히려 밝게 보인다). 버스·지하철은 아이콘 모양으로 구분된다 | 주 버튼은 구분된다. 1순위와 2·3순위는 글씨 크기 차이로 구분된다. 배경에 기대는 곳은 목적지 판 하나뿐이고 흑백에서도 옅은 회색으로 보인다 |
| | *세 방향 모두 노선(3호선, 4호선, 100번)을 색 없이 글자로만 적어서 흑백에서 잃는 정보가 없다. 대신 원본에서도 노선 색이 없다* | | |
| **구현** (네 화면에 보이는 새 부품) | 5개: 위치 띠, 아래로 붙는 안내판 틀, 점 세 개, 단계 띠, 경로 줄(시간표 모양). 그림 없음 | 5개: 카드(흰색·강조), 아이콘을 넣는 부품, 진행 막대, 주 버튼이 본문에 들어가는 틀, 다른 방법 줄. 여기에 아이콘 그림 12개 | 5개: 가운데 정렬 틀, 상징 그림 자리, 퍼지는 고리, 큰 글씨 줄 + 작은 제목, 되짚는 판. 여기에 직접 그린 그림 3개(마이크, 듣는 마이크, 길) |
| (14개 화면으로 넓힐 때, 추정) | 알림 상자(`CHECKING`) 등 1~2개 더. 위치를 모든 화면에서 알고 있어야 한다 | 화면마다 아이콘을 더 골라야 한다(예·아니오, 다시 말하기, QR 등). 버튼이 본문과 아래로 나뉘어 화면마다 어디에 둘지 정해야 한다 | 화면마다 그림을 더 그려야 한다(알아듣는 중, 준비 중, 안내 불가, QR 등 4~5개). 목록 화면은 상징 없이 따로 배치해야 한다 |
| **일관** (네 화면이 같은 키오스크로 보이는가) | 네 화면 모두 위에 띠, 가운데 빈 곳, 아래에 내용과 버튼. 버튼 자리가 같다. `ROUTING` 만 버튼이 없어 내용이 맨 아래까지 내려간다 | 네 화면 모두 왼쪽 위 제목 + 바로 아래 카드. 카드 색이 화면에 따라 흰색·강조로 바뀌고, 아래 버튼이 0~2개로 달라진다 | 네 화면 모두 가운데 정렬. 덩어리가 시작하는 높이와 버튼 높이가 화면마다 다르다(마지막 버튼 아래 끝 1,412~1,513px). `ROUTE_GUIDE` 에는 그림이 없고 `IDLE` 에만 위쪽 위치 줄이 있다 |

"구현"의 14개 화면 부분은 스크린샷에 없는 화면을 짐작한 것이라 추정으로 표시했다.

핵심 줄 아래 끝에서 첫 버튼 위 끝까지 거리 (지금 화면은 880~1,380px):

| 화면 | A | B | C |
|---|---|---|---|
| `IDLE` | 125px | 216px | 146px |
| `LISTENING` | 117px | 130px | 138px |
| `ROUTE_GUIDE` | 350px | 99px | 409px |

## 시안과 실제 앱이 다른 점

- `LISTENING` 은 실제 마이크 모드(글 입력창 없음)로 그렸다
- A 는 위치 띠를 모든 화면에 보인다. 지금 앱은 첫 화면에서만 위치를 불러온다
- A 의 단계 띠 문구("가실 곳 → 확인 → 길 찾기")와 B·C 의 그림은 지금 화면에 없는 새 요소다. 버튼의 종류·개수·문구는 그대로다
- 시안 전용 토큰(카드 여백, 아이콘 크기, 72px, 움직임 길이 등)은 각 `*.css` 의 `:root` 에 "시안 전용"으로 표시해 두었다. 디자인 문서에는 아직 없다
- `MANUAL_SELECT` 시안은 12개를 채우려고 목적지 3개를 지어 넣었고 테스트용 항목은 뺐다

## 파일

| 파일 | 내용 |
|---|---|
| `index.html` | 비교 페이지 (원본 / 흑백 / 축소) |
| `a.html` `a.css` / `b.html` `b.css` / `c.html` `c.css` | 방향별 화면과 배치 |
| `base.css` | 공통. 토큰·글꼴·버튼은 `frontend/src/styles/global.css` 를 그대로 불러온다 |
| `mock.js` | `?s=` 로 화면 하나만 보이기, `&measure=1` 로 하한선 검사 |
| `shoot.sh` `derive.html` | 스크린샷 다시 찍기: Git Bash 에서 `bash shoot.sh`. Edge 만 쓴다 |
| `shots/<방향>-<화면>.png` | 원본 1080×1920 |
| `shots/<방향>-<화면>-gray.png` | 흑백 1080×1920 |
| `shots/<방향>-<화면>-small.png` | 1/4 축소 270×480 |
| `icons/` `build-sprite.mjs` | B 의 아이콘 12개 (Material Symbols Outlined, Apache License 2.0, `@material-symbols/svg-400@0.27.0`) 와 이를 `b.html` 에 넣는 스크립트 |

## v2: 발표 시연용 시안 (2026-11-16)

시안 C(큰 단계형)의 배치를 뼈대로 다시 만든 것이다. 기준은 `docs/design-guidelines.md` 개정 2.

- `v2.html`: 네 화면(`IDLE`, `LISTENING`, `ROUTING`, `ROUTE_GUIDE`). 한 화면만 보려면 `v2.html?s=IDLE`
- `v2-demo.html`: 시연용. 화면을 누르면 실제 흐름 순서로 다음 화면으로 넘어간다 (0.25초 전환). 창 크기에 맞춰 줄어든다
- `v2.css` `v2.js`: 배치와 움직임. 스크린샷은 `shots/v2-<화면>.png`, 검사 결과는 `shots/v2-measure.txt`

네 화면을 잇는 모양은 노선도의 "역 고리와 선"이다: 고리 안 마이크(IDLE) → 고리 둘레 음량 막대(LISTENING) → 고리로 흘러가는 점선(ROUTING) → 고리와 노선색 선의 타임라인(ROUTE_GUIDE).

시안에서 지어 넣은 것:
- 음량은 가짜 값이다. 실제 앱에서는 녹음 부품이 마이크 음량을 알려 줘야 한다 (지금은 없는 기능)
- 경로 예시: 종로3가역 →(3호선 2정거장: 을지로3가, 충무로)→ 충무로역 →(4호선 1정거장)→ 명동역. 역 순서와 정거장 수는 아는 범위에서 맞췄다
- **확실하지 않은 값**: 소요 시간 "약 12분", "걸어서 약 20분"은 짐작이다. 노선색 두 개(`#EF7C1C`, `#00A5DE`)는 공식 자료로 확인하지 않았다. 정류장에서 종로3가역까지 걷는 구간은 그리지 않았다
- 서비스 이름 "말길"과 로고 자리(고리 모양)는 임시다 (문서 5절, 팀 결정 필요)
- 화면 제목 "말씀해 주세요"(`LISTENING`)는 "듣고 있어요"와 겹쳐서 화면에 보이지 않게 뺐다. 버튼의 종류·개수·문구는 그대로다

### 타임라인에 필요한 구간 정보 (백엔드 제안)

지금 `/route` 응답의 경로 하나는 `{ id, rank, summary, durationMin, transfers }` 다. 여기에 `legs`(구간 배열, 타는 순서대로)를 더하면 타임라인을 그릴 수 있다. 기존 필드는 그대로 둔다.

| 필드 | 뜻 | 예 |
|---|---|---|
| `mode` | 이동 수단 | `"SUBWAY"`, `"BUS"`, `"WALK"` |
| `lineId` | 노선을 가리키는 고정 값. 화면이 노선색을 찾는 데 쓴다. 걷는 구간은 `null` | `"seoul-3"` |
| `lineName` | 화면에 그대로 보일 노선 이름 | `"지하철 3호선"` |
| `from` | 타는 곳 이름 | `"종로3가역"` |
| `to` | 내리는 곳 이름 | `"충무로역"` |
| `stops` | 탄 곳 다음부터 내리는 곳까지 지나는 정거장 수(내리는 곳 포함). 화면은 "N번째 역에서 내려요"로 보인다. 걷는 구간은 `null` | `2` |
| `boardSide` | 선택 항목, 표시 안 함. 버스를 타는 정류장의 방향: `"SAME"`(이 정류장) / `"ACROSS"`(길 건너편). 지금 카카오 응답과 백엔드에는 없다 | `"ACROSS"` |
| `via` | 선택 항목, 표시 안 함. 탄 곳 다음부터 내리는 곳까지 지나는 역·정류장 이름 (마지막이 내리는 곳). 있으면 `stops` 대신 개수를 셀 수 있다 | `["을지로3가", "충무로"]` |
| `durationMin` | 구간 소요 시간(분). 없으면 `null` | `4` |

```json
{
  "id": "route-1",
  "rank": 1,
  "summary": "지하철 3호선 → 4호선",
  "durationMin": 12,
  "transfers": 1,
  "legs": [
    { "mode": "SUBWAY", "lineId": "seoul-3", "lineName": "지하철 3호선", "from": "종로3가역", "to": "충무로역", "stops": 2, "durationMin": 4 },
    { "mode": "SUBWAY", "lineId": "seoul-4", "lineName": "지하철 4호선", "from": "충무로역", "to": "명동역", "stops": 1, "durationMin": 2 }
  ]
}
```

앞 구간의 `to` 와 다음 구간의 `from` 이 같으면 화면은 그 역을 "갈아타는 곳"으로 그린다. `legs` 가 없으면 화면은 지금처럼 `summary` 한 줄만 보여 준다.

## v3: IDLE 세 가지 스타일 (2026-11-16)

v2 가 단순하다는 평가를 받고, `design/references/` 를 본 뒤 IDLE 화면만 서로 다른 스타일 세 개로 만든 것이다. 나란히 보기: `v3.html` (그림은 `shots/v3-side-by-side.png`).

| 파일 | 스타일 | 화면의 색 |
|---|---|---|
| `v3-1.html` | 노선도. 1·3·5호선 띠와 역 번호 원(130, 329, 534)이 화면을 가로지른다 | 노선색 세 가지 + 검정·흰색·주 버튼 파랑 |
| `v3-2.html` | 지도. 종로 일대 지도 + "지금 여기" + 아래에서 올라온 둥근 판 | 지도색(땅·물·공원) + 다홍 표시 + 노선색 고리 |
| `v3-3.html` | 승차권. 초록 면, 노란 말풍선, 절취선, 표에 찍힌 칸 | 짙은 초록·노랑(서울 버스 색) + 검정·흰색·주 버튼 파랑 |

공통: 예시 문구 네 개가 4초마다 바뀐다(`v3.js`), 시각과 날짜는 실제 값이다. 하한선 검사 결과는 `shots/v3-measure.txt`.

채택하면 디자인 문서에 먼저 넣어야 하는 것 (지금은 시안에만 있다):
- 글씨·배경 조합: 흰 글씨 + `#0F5132`(9.36:1), 검정 + `#FFD23F`(13.08:1), 검정 + `#CFE5C8`(14.11:1). 노랑 위 보조 글씨(`#444444`)는 6.74:1 로 쓸 수 없다
- 글씨 크기: 질문 150~160px (문서의 120px 은 숫자 전용이다)
- 움직임: 예시 문구가 자동으로 바뀌는 것 (문서 3-5절은 "자동으로 넘어가는 내용은 넣지 않는다"고 적혀 있다)
- 노선색 1호선 `#0052A4`, 5호선 `#996CAC` (임시, 확인 필요). 1호선 파랑은 주 버튼 파랑과 거의 같다

확실하지 않은 것: 역 번호(130, 329, 534), 노선색 값, 지도의 길·건물 자리(대략 그린 것). 옆 역 이름과 순서는 아는 범위에서 맞췄다.

## v4: IDLE 확정 방향 (2026-11-16)

v3-1(노선도 스타일)을 고르고, 시선 순서 규칙(`docs/design-guidelines.md` 3-9절)에 맞춰 다시 만든 것이다.
눈이 가는 순서: **주 버튼 '말하기' → 큰 질문 → 예시 문구 → 노선 그림과 그 밖의 정보**.

- `v4-subway.html` `v4-bus.html` `v4-default.html`: 세 파일은 맨 위 `window.PLACE` 값만 다르다. 구조와 스타일(`v4.css`)은 같다
- `v4-diagram.js`: 장소 정보로 위쪽 그림을 그리는 부품. 실제 앱에서는 React 부품으로 옮긴다
- `v4.html`: 세 장 나란히 보기 (+ v3-1 비교). `v4-check.html`: 흐림·흑백·축소 검사 한 장 (`shots/v4-check.png`)
- 다시 찍기: `bash v4-shoot.sh`

### 장소 정보 형식 (백엔드 제안)

`/location` 응답에 `place` 를 더한다. 색은 서버가 주지 않는다. 화면이 `lineId`·`kind` 로 색 토큰을 찾는다 (경로의 `legs[].lineId` 와 같은 값).

지하철역:

```json
{
  "type": "SUBWAY_STATION",
  "name": "종로3가역",
  "lines": [
    { "lineId": "seoul-1", "label": "1", "stationNo": "130", "prev": "종각", "next": "종로5가" },
    { "lineId": "seoul-3", "label": "3", "stationNo": "329", "prev": "안국", "next": "을지로3가" },
    { "lineId": "seoul-5", "label": "5", "stationNo": "534", "prev": "광화문", "next": "을지로4가" }
  ]
}
```

버스정류장:

```json
{
  "type": "BUS_STOP",
  "name": "종로3가.탑골공원 정류장",
  "buses": [
    { "kind": "TRUNK", "numbers": ["101", "260", "270", "720"] },
    { "kind": "BRANCH", "numbers": ["7212"] },
    { "kind": "EXPRESS", "numbers": ["9301"] }
  ],
  "nearSubway": { "name": "종로3가역", "lines": [{ "lineId": "seoul-1", "label": "1" }, { "lineId": "seoul-3", "label": "3" }, { "lineId": "seoul-5", "label": "5" }] }
}
```

| 필드 | 뜻 |
|---|---|
| `type` | `"SUBWAY_STATION"` 또는 `"BUS_STOP"`. 그 밖의 값이나 `place` 가 없으면 기본 그림 |
| `lines[].label` | 노선 번호 원 안에 보일 글자 (`"1"`, `"경의중앙"` 처럼 길면 그림이 넘친다. 4자 이하 권장) |
| `lines[].stationNo` | 역 번호. **선택 항목, 지금은 화면에 표시하지 않는다** (v8 에서 이름판의 역 번호 원을 뺐다). 없으면 `null` 이거나 빼도 된다 |
| `lines[].prev` / `next` | 앞뒤 역 이름. 종점이면 `null` |
| `buses[].kind` | `"TRUNK"`(간선), `"BRANCH"`(지선), `"EXPRESS"`(광역), `"CIRCULAR"`(순환) |
| `buses[].numbers` | 버스 번호. 화면은 종류마다 4개까지 보이고 나머지는 "외 N대" |
| `nearSubway` | 가까운 지하철역. **선택 항목, 지금은 화면에 표시하지 않는다** (v8 에서 이름판의 가까운 지하철 줄을 뺐다). 없으면 `null` 이거나 빼도 된다 |

그림은 노선 4개, 버스 종류 4개까지 그린다. 시안의 `example: true` 는 "버스 번호는 예시"라고 표시하려고 넣은 시안 전용 값이다.

### 확실하지 않은 것

- 버스 번호(101, 260, 270, 720, 7212, 9301)는 **예시**다. 이 정류장에 실제로 서는지 확인하지 못했다
- 역 번호(130, 329, 534), 노선색, 버스 종류 색은 공식 자료로 확인하지 않았다 (문서 3-6절 "확인 필요")
- 질문 글씨 108px 은 문서에 없는 크기다 (문서의 큰 글씨는 72px 과 120px 숫자 전용)

## v5: IDLE 가로 캔버스 1920×1080 (2026-11-16)

시연 기기가 가로 모니터와 프로젝터라서 v4 의 스타일을 가로로 옮긴 것이다. `frontend/` 와 디자인 문서의 캔버스는 아직 세로(1080×1920) 그대로다.

- `v5-subway.html` `v5-bus.html` `v5-default.html`: 세 파일은 `window.PLACE` 값만 다르다. `build-v5.mjs` 가 v4 의 부품과 장소 정보에서 만들어 낸다 (`node build-v5.mjs`)
- 좌우 두 칸: 왼쪽 1160px(이 화면의 내용) / 사이 64px / 오른쪽 600px(공통 행동 버튼, 아래쪽에 붙임)
- 질문은 주 버튼과, 예시 문구는 보조 버튼과 같은 높이에 놓았다
- 노선 그림은 1160×340px (화면 넓이의 19%, v4 와 같은 비율)
- 다시 찍기: `bash v5-shoot.sh`. 그림은 `shots/v5-<이름>.png`, `-blur`, `-gray`, `-portrait`(세로 창에 맞춰 56%로 줄인 모습)
- 제안(확정 아님): `v5-subway.html?rail=1` 은 오른쪽 칸을 옅은 판으로 보인다 (`shots/v5-subway-rail.png`)

## v9: 띠 시험과 규칙 (2026-11-17, 확정 전)

IDLE 시안(v8)을 확정하기 전에 극단적인 데이터로 띠를 시험하고, 규칙을 적용한 판을 만든 것이다. v8 파일은 고치지 않았다.

- `v9-cases.js`: 시험용 장소 정보 (노선 1·2·5개, 종점, 갈림길, 버스 6종류, 긴 이름). 주소에 `?case=seoul` 처럼 붙인다
- `v8-test.html`: v8 그대로 + 시험 데이터 (어디가 깨지는지 보는 용도)
- `v9-test.html`: 띠 규칙 적용 (`v9-band.js`, `v9-extra.css`). `?strong=1` 을 붙이면 노선 선이 한 단계 진해진다
- `v9-before.html` / `shots/v9-before.png`: 같은 데이터의 전후 비교 (띠만 잘라서)
- `v9-reduced.html`: IDLE_REDUCED (음성을 쓸 수 없을 때)
- `v9-thin.html`: 얇은 띠(96px) 예시. IDLE 이 아닌 화면용 제안
- `build-v9.mjs`: `v8-test.html`, `v9-test.html`, `v9-reduced.html` 을 v8 에서 만든다

띠 규칙은 `v9-band.js` 맨 위 주석(A~I)에 있다. 아직 디자인 문서에는 넣지 않았다.

## 확정 시안: IDLE 과 띠 (2026-11-17) — confirmed/

기준은 `docs/design-guidelines.md` 8절 '첫 화면과 띠'다. 가로 캔버스 1920×1080.

| 파일 | 내용 |
|---|---|
| `idle-final-subway.html` | IDLE, 지하철역 (종로3가역) |
| `idle-final-bus.html` | IDLE, 버스정류장 (종로3가.탑골공원 정류장. 버스 번호는 예시) |
| `idle-final-default.html` | IDLE, 장소 정보가 없을 때 |
| `idle-reduced-final.html` | IDLE_REDUCED (음성을 쓸 수 없을 때). 주 버튼이 '손으로 고르기' |
| `band-thin.html` | 얇은 띠(96px). IDLE 이 아닌 화면용. MANUAL_SELECT 로 본 예시 |
| `idle-final.css` | 위 화면의 스타일 (v8.css + v10-extra.css 를 모은 것) |
| `idle-band.js` | 띠 부품. 장소 정보(`window.PLACE`)로 띠를 그린다. 규칙은 파일 맨 위 주석과 문서 8-4절 |
| `archive/build-final.mjs` | 위 파일을 다시 만든다: `archive/` 에서 `node build-v9.mjs && node build-v10.mjs && node build-final.mjs` |

- 클래스 이름에는 만들던 때의 `v8-`, `v9-` 가 그대로 남아 있다. 실제 앱으로 옮길 때 다시 짓는다
- 주소에 붙여 볼 수 있는 것: `?strong=1`(선을 진하게, 프로젝터용), `?name=이름`(이름 길이 시험), `?pn=128`(이름 크기), `?ql=220`(질문 시작 위치), `?fq=120`(질문 크기)
- 띠 시험: `v10-test.html?case=seoul` (경우 목록은 `v9-cases.js`), 세 판 비교는 `v10-compare.html` / `shots/v10-compare.png`
- 만들어 온 과정의 파일(v1~v9)은 기록으로 남겨 두었다. v8 은 모양의 기준, v9 는 규칙을 시험한 판, v10 은 둘을 합친 확정판이다

## 확정 시안: LISTENING (2026-11-17) — confirmed/

| 파일 | 내용 |
|---|---|
| `listening-final.html` | LISTENING (실제 마이크 모드, 글 입력창 없음). 듣는 중 표시 640px: 고리(`--halo-r`, `--ring-r`) + 마이크(`--ring-icon`) + 음량 막대 40개(길이와 진하기가 음량을 따른다, 가짜 값). 오른쪽: 다 말했어요 / 취소 / 처음으로. `?freeze=0.6` 은 그 시각으로 멈춤 |
| `wait-shoot.sh` | 다시 찍기 (기다림 화면과 함께): `confirmed/` 에서 `bash wait-shoot.sh` → `shots/listening-final.png` (+ -blur) |

- 배경: 흰 배경으로 확정 (2026-11-17). 옅은 파랑 안(`?bg=blue`)은 지웠다
- 고리와 가운데 그림은 기다림 화면 5개(`wait-final.html`)와 같은 부품이다 (`shared/flow.css` 의 `.ring-*`)

## 확정 시안: 기다림 화면 5개 (2026-11-17) — confirmed/

| 파일 | 내용 |
|---|---|
| `wait-final.html` | STARTUP_CHECK, CHECKING, RESOLVING, ROUTING(기본), FAIL_COUNT_CHECK. `?s=RESOLVING` 처럼 화면을 고른다. `?s=RESOLVING&heard=` 는 들은 말이 빈 경우. `?freeze=0.5` 는 그 시각으로 멈춤 |
| `wait.css` | 공통 배치: 얇은 띠 아래 화면 가운데에 고리 → 작은 머리말 → 큰 글씨(112px, 72px 까지 줄임) → 안내 한 줄. 버튼 칸 없음 |
| `shots/wait-*.png` `shots/wait-five.png` `shots/listening-wait.png` | 화면별 그림과 흐림, 다섯 장 나란히, LISTENING 과 RESOLVING 나란히. 다시 찍기 `bash wait-shoot.sh` |

- 고리는 화면 가운데(A안)다. LISTENING 의 고리(왼쪽 칸)와 자리가 다르다. 이유는 디자인 문서 10절
- 가운데 그림(깃발, 말풍선, 로고)은 152 칸에 선 굵기 9.5 로 손으로 그렸다. 로고는 띠의 로고보다 선이 가늘다

## 확정 시안: ROUTE_GUIDE (2026-11-17) — confirmed/

기준은 `docs/design-guidelines.md` 3-6절(노선 표시)과 9절(경로 규칙 R1~R8, 데이터 형식, 백엔드 요청).

| 파일 | 내용 |
|---|---|
| `route-guide-final.html` | ROUTE_GUIDE. 오른쪽 경로 카드(최대 3개) + 왼쪽 타임라인. 버스·번호 없는 노선·걸어서만·장소 목적지를 모두 그린다. 주소 값 없음 = 버스정류장(종로3가.탑골공원), `?set=subway`(지하철역 종로3가, 경로 A·B·C), `?pick=2`, `?set=long`, `?case=...`. 띠 이름은 데이터 묶음의 `place` 에서 가져온다 (2026-11-17) |
| `route-cases.js` | 시험 데이터 10가지 (환승 3회, 경로 1·2개, 걸어서만, 카드 노선 줄이 긴 경우, 긴 이름, 번호 없는 노선, 장소 목적지, 출구 없음, 탈것 3개 모두 긴 이름)와 지하철역 묶음(`window.ROUTE_SUBWAY`). 시험 데이터의 띠는 모두 지하철역 "종로3가"이고 모든 경로가 종로3가역에서 출발한다(4번 E, 9번 LT 도 띠에 맞춰 바꿨다). 시간·번호는 예시, 4·9번 경로는 지어낸 길. 왼쪽 아래 예시 안내는 버스가 있으면 "버스 번호, 시간, 출구는 예시예요", 없으면 "시간과 출구는 예시예요" (시안 전용) |
| `route-shoot.sh` | 다시 찍기: `confirmed/` 에서 `bash route-shoot.sh` → `shots/bus-*.png`, `shots/subway-*.png`, `shots/case-*.png`, `shots/bus-measure.txt` |

- 예전 지하철만의 `wip/route-guide.html` 은 시연 페이지(`wip/demo.html`)가 쓰고 있어 `wip/` 에 그대로 두었다
- 클래스 이름과 화면 구조는 시안용이다. 실제 앱으로 옮길 때 React 부품으로 다시 짓는다

## 확정 시안 모아 보기 (2026-11-17) — confirmed/

| 파일 | 내용 |
|---|---|
| `overview.html` | 확정 화면 15칸을 실제 흐름 순서로 한 줄에 2개씩 (IDLE 3가지 → IDLE_REDUCED → LISTENING → RESOLVING → ROUTING → ROUTE_GUIDE 5가지 → STARTUP_CHECK → CHECKING → FAIL_COUNT_CHECK). 마지막 칸은 아직 시안이 없는 화면 안내(글자 칸, 화면 칸과 같은 크기. 시안이 확정되면 저절로 빠진다). 맨 위에 확정 수(9 / 14)와 시안이 없는 화면. 칸을 누르면 그 화면만 창에 맞춰 크게(1920×1080 창이면 실제 크기), ← → 앞뒤, Esc·닫기 |
| `shots/overview-full.png` `shots/overview-lightbox.png` | 1920×1080 창에서 찍은 페이지 전체와 크게 보기 (로컬 서버로 연 것) |
| `shots/overview-file.png` | 파일을 바로(`file://`) 열어 Edge 로 찍은 페이지 전체 |

- 확정 파일을 복사하지 않고 iframe 으로 불러온다. 확정본을 고치면 바로 반영된다. 화면 목록은 파일 안 `SCREENS` 한 곳
- 변형은 확정 파일이 받는 주소 값으로 연다: `route-guide-final.html?set=subway&pick=1|2`, `?pick=2`, `?set=long`, `?case=one`, `wait-final.html?s=...`
- 더블클릭(`file://`)으로 열어도 된다. Edge 에서 iframe 14개, Pretendard 글꼴, 크게 보기의 키(Esc·← →)를 확인했다 (2026-11-17). `file://` 에서는 이 페이지가 iframe 안을 읽을 수 없어서, 페이지는 iframe 안을 읽지 않게 만들었다

## IDLE 다음 화면: LISTENING, ROUTING, ROUTE_GUIDE (2026-11-17, 확정 전) — wip/

IDLE 확정안과 얇은 띠(`band-thin.html`)를 바탕으로 만든 시안이다. 기준은 `docs/design-guidelines.md` 6절·8-1절. 지하철역(종로3가) 기준.

| 파일 | 내용 |
|---|---|
| `../confirmed/listening-final.html` | LISTENING 확정본으로 옮겼다 (2026-11-17). 기본은 흰 배경, `?bg=blue` 는 옅은 파랑 안 |
| `routing.html` `wait.css` | 기다림 틀 다섯 화면(네 번째 판): LISTENING 과 같은 고리를 가운데에, 바깥 고리 위를 도는 호, 가운데 그림(깃발·말풍선·로고·남은 초), 큰 글씨 112px. `?s=RESOLVING` 처럼 화면을 고른다 |
| `route-guide.html` | ROUTE_GUIDE. 오른쪽 칸의 경로 카드 3개를 눌러 왼쪽 타임라인을 바꾼다. `?pick=2` 는 2순위가 선택된 채로, `?labels=ends` 는 역 라벨을 타는 곳·내리는 곳만 |
| `../confirmed/route-guide-final.html` `route-shoot.sh` | ROUTE_GUIDE 확정본으로 옮겼다 (2026-11-17). 경로 규칙 R1~R8 은 디자인 문서 9절과 파일 맨 위 주석. `?pick=2`, `?set=long`, `?case=...` |
| `../confirmed/route-cases.js` | ROUTE_GUIDE 시험 데이터 10가지(옮김). `route-guide-final.html?case=transfer3` 처럼 쓴다 (one, two, walk, longcard, longname, named, place, noexit, longthree). 그림은 `confirmed/shots/case-*.png` |
| `demo.html` | 시연. 화면을 누르면 IDLE → LISTENING → ROUTING → ROUTE_GUIDE 로 넘어간다 (0.25초 나타나기). `?bg=blue`, `?at=2` |
| `../shared/flow.css` | 세 화면의 공통 틀(옮김): 얇은 띠, 왼쪽 칸(x 140), 오른쪽 버튼 칸(600), 버튼 모양, 고리 |
| `flow-shoot.sh` `flow-compare.html` | 다시 찍기: `wip/` 에서 `bash flow-shoot.sh`. 그림은 `wip/shots/flow-*.png`, 검사 값은 `wip/shots/flow-measure.txt` |

시안에서 지어 넣은 것: 음량(가짜 값), 소요 시간·걷는 시간·출구 번호(모두 예시. 도착 시각은 지금 시각에 소요 시간을 더한 값).
세 경로(3→4호선 충무로 환승, 1→4호선 서울역 환승, 5→4호선 동대문역사문화공원 환승)의 노선과 정거장 수는 아는 범위에서 맞췄고 공식 자료로 확인하지 않았다.
경로 카드는 화면 안에서 선택된 경로만 바꾼다. 상태·전이는 그대로다 (`docs/kiosk-workflow.md` 의 '전이가 아닌 화면 안 동작'). '휴대폰으로 보내기'가 선택된 경로를 보내는지는 팀 확인 필요.

## 확정 시안: REASKING, UNAVAILABLE, QR_HANDOFF, MANUAL_SELECT 불러오는 중·오류 (2026-11-19) — confirmed/

기준은 `docs/design-guidelines.md` 12절. 지하철역(종로3가) 기준. 이것으로 상태 14개가 모두 확정본을 갖는다 (`overview.html` 14 / 14).

| 파일 | 내용 |
|---|---|
| `reasking-final.html` | REASKING. LISTENING 자리(x 460, y 495)의 옅은 고리와 마이크(움직임 없음), 아래에 제목 → "잘 못 알아들었어요"(72px) → 들은 말 → IDLE 예시 한 줄. `?heard=` 들은 말 없음 |
| `unavailable-final.html` | UNAVAILABLE. 같은 자리의 본문색 고리, 가운데 그림은 이유마다 (깃발·걷는 사람·지도 핀·시계). 이유 첫 문장만 72px 오류 색. `?r=` 로 이유를 고른다 |
| `qr-handoff-final.html` | QR_HANDOFF. QR(그림 480 + 여백 40), 오른쪽에 단계 세 줄(48px 굵게, 번호는 노선 번호 원 모양), 오른쪽 칸에 보내는 경로 요약 판 + 처음으로. QR 그림은 예시(찍어도 열리지 않는다) |
| `manual-select-final.html?state=loading` · `?state=error` | MANUAL_SELECT 불러오는 중(작은 고리 + 도는 호)·목록 오류. 별도 파일(`wip/manual-select-states.html`)이었던 것을 합쳤다 |
| `states.css` | 위 네 화면의 공통 스타일 (큰 고리 묶음, 작은 고리, 핵심 줄·들은 말·오류 색) |
| `states-shoot.sh` | 다시 찍기: `confirmed/` 에서 `bash states-shoot.sh` → `shots/reasking*.png`, `unavailable-*.png`, `qr*.png`, `manual-loading*.png`, `manual-error*.png` (+ -blur), `states-all.png`, `states-timeout.png`, `states-measure.txt` |

- 시안 중간에 만든 안(REASKING 의 작은 고리 안, 핵심 줄을 주 버튼 높이에 맞춘 1차 안, QR 의 휴대폰 그림 (가)안, 예시 세 줄 `?say=3`)은 지웠다. 그때의 스크린샷도 남기지 않았다
- QR 단계 문구는 실제 앱(`QrHandoffScreen.jsx`)과 다르다. 구현할 때 코드 문구를 바꿔야 한다 (문서 12절)
