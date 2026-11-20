// POST /api/v1/location 의 실제 구현. 첫 화면의 '지금 계신 곳' 표시에 쓰고, 이후 길 안내의 출발지를 정한다.
//
// 1) 브라우저 위치 기능(navigator.geolocation: GPS·와이파이 추정)으로 좌표를 받는다.
//    localhost 나 https 에서만 동작하고, 처음 한 번 브라우저가 위치 허용을 묻는다.
// 2) 좌표를 STT 서버에 알린다. 서버는 가장 가까운 정류장·역에 맞춘 출발지를 이 키오스크의 현재 위치로 기억하고,
//    이후 /stt·/resolve·/pois 에서 그 위치를 쓴다. 그래서 그 호출들은 좌표를 따로 보내지 않는다.
//    경로 조회만은 다른 서버(server/app.py)가 맡아서, 서버가 돌려준 출발지 좌표를 여기서 기억해 두고 route.js 가 꺼내 쓴다.
// 3) 위치를 못 받았거나 서버가 쓸 수 없다고 판단하면(오차가 큼·서울 밖) 서버 설정의 키오스크 고정 위치가 쓰인다.
//    좌표 없이도 서버에 알리는 이유: 전에 기억해 둔 위치를 지우고 고정 위치로 돌아가게 하려는 것.
//
// 결과: { name, text, source: 'GPS' | 'KIOSK', snapped, accuracyM, reason, place }
//   text    화면에 그대로 보여 줄 문장. 예) '지금 계신 곳: 경동시장앞 정류장'
//   snapped 정류장·역 바로 근처라 그곳으로 맞췄으면 true. 조금 떨어져 있으면 false 이고 이름이 '○○ 정류장 근처'
//   reason  고정 위치를 쓰게 된 이유. GPS 를 썼으면 null
//           브라우저 쪽: NO_GEOLOCATION(기능 없음·보안 연결 아님) / PERMISSION_DENIED / POSITION_UNAVAILABLE / TIMEOUT
//           서버 쪽:    LOW_ACCURACY(오차가 큼) / OUT_OF_AREA(안내 범위 밖) / INVALID_POSITION
//   place   큰 띠의 장소 정보 (디자인 문서 8-5절 형식). 서버가 아직 주지 않으므로 지금은 늘 null → 띠는 "정보 없음"
//           서버가 data.place 를 주면 그대로 쓴다 (docs/team-requests.md #1)
// 서버 호출이 실패하면 Error 를 throw 한다. 화면은 위치 줄을 비워 둔다 (전이 없음).

import { apiFetch, errorMessageOf, KIOSK_ID } from './http.js'

const POSITION_TIMEOUT_MS = 8000
const GEO_ERROR = { 1: 'PERMISSION_DENIED', 2: 'POSITION_UNAVAILABLE', 3: 'TIMEOUT' }

let lastOrigin = null

/** 서버가 마지막으로 정해 준 출발지 { name, x(경도), y(위도) }. 아직 위치를 알린 적이 없으면 null (route.js 전용) */
export function getOrigin() {
  return lastOrigin
}

/** 기억해 둔 출발지를 지운다 (테스트용) */
export function clearOrigin() {
  lastOrigin = null
}

/** 브라우저 위치를 한 번 읽는다. 실패해도 throw 하지 않고 이유를 돌려준다 → { position: {x, y, accuracy} | null, reason } */
export function readPosition(timeoutMs = POSITION_TIMEOUT_MS) {
  const geo = globalThis.navigator?.geolocation
  if (!geo) return Promise.resolve({ position: null, reason: 'NO_GEOLOCATION' })
  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (pos) =>
        resolve({
          position: { x: pos.coords.longitude, y: pos.coords.latitude, accuracy: pos.coords.accuracy ?? null },
          reason: null,
        }),
      (err) => resolve({ position: null, reason: GEO_ERROR[err?.code] ?? 'POSITION_UNAVAILABLE' }),
      // 1분 안에 읽은 위치는 다시 쓰고(처음 화면으로 돌아올 때마다 부르므로), 8초 안에 못 받으면 고정 위치로 간다
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    )
  })
}

export async function getLocation() {
  const { position, reason: browserReason } = await readPosition()

  // 좌표는 주소(URL)에 싣지 않고 본문으로 보낸다 (접속 로그에 남지 않게)
  const report = { kiosk_id: KIOSK_ID }
  if (position) {
    report.x = position.x
    report.y = position.y
    if (position.accuracy !== null) report.accuracy = position.accuracy
  }
  const body = await apiFetch('/location', { method: 'POST', json: report })
  if (!body.success) throw new Error(errorMessageOf(body, 'LOCATION_ERROR'))

  const d = body.data ?? {}
  if (Number.isFinite(d.x) && Number.isFinite(d.y)) lastOrigin = { name: d.name ?? '', x: d.x, y: d.y }
  const result = {
    name: d.name ?? '',
    text: d.easy_text ?? (d.name ? `지금 계신 곳: ${d.name}` : ''),
    source: d.source ?? 'KIOSK',
    snapped: Boolean(d.snapped),
    accuracyM: d.accuracy_m ?? null,
    reason: d.source === 'GPS' ? null : (browserReason ?? d.fallback_reason ?? null),
    place: d.place ?? null,
  }
  console.info('[location]', result.source, result.name, result.reason ?? '', result.accuracyM !== null ? `±${result.accuracyM}m` : '')
  return result
}
