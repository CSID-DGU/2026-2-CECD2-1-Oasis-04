// 키오스크가 놓인 곳("지금 계신 곳")을 어떻게 정할지. 설정 페이지의 '위치' 탭(LocationTab.jsx)에서 바꾸고 브라우저에 저장한다.
//
//   { mode: 'auto' }                    브라우저 위치(GPS·무선랜)로 가장 가까운 역·정류장을 찾는다. 처음 값
//                                       위치를 못 받거나 오차가 크면 서버 설정의 고정 위치가 쓰인다
//   { mode: 'manual', place: {...} }    설정에서 고른 역·정류장을 쓴다. place = { poiId, name, type, number, line }
//
// 유선 인터넷만 쓰는 PC 는 브라우저가 인터넷 주소로 위치를 짐작해서 오차가 몇 km 씩 난다. 그런 기기에서는 직접 정한다.
// api/real/location.js 가 위치를 서버에 알릴 때 이 값을 읽는다.

export const PLACE_KEY = 'oasis.kioskPlace'
export const AUTO = Object.freeze({ mode: 'auto' })

const defaultStorage = () => {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null // 저장소를 막아 둔 브라우저
  }
}

/** 저장된 값. 없거나 읽을 수 없으면 자동 */
export function readKioskPlace(storage = defaultStorage()) {
  try {
    const saved = JSON.parse(storage?.getItem(PLACE_KEY) ?? 'null')
    if (saved?.mode === 'manual' && typeof saved.place?.poiId === 'string' && saved.place.poiId) {
      const { poiId, name = '', type = null, number = '', line = '' } = saved.place
      return { mode: 'manual', place: { poiId, name, type, number, line } }
    }
  } catch {
    // 깨진 값은 없는 것으로 본다
  }
  return AUTO
}

/** 저장한다. 자동이면 저장된 값을 지운다. 저장하지 못했거나 직접 정했는데 고른 곳이 없으면 false */
export function writeKioskPlace(value, storage = defaultStorage()) {
  try {
    if (value?.mode === 'manual') {
      if (!value.place?.poiId) return false
      storage?.setItem(PLACE_KEY, JSON.stringify({ mode: 'manual', place: value.place }))
    } else {
      storage?.removeItem(PLACE_KEY)
    }
    return Boolean(storage)
  } catch {
    return false
  }
}

/** 고른 곳을 한 줄로: '종로3가역 · 1호선 · 역 번호 130', '종로3가.탑골공원 정류장 · 정류장 번호 01-013' */
export function placeText(place) {
  if (!place) return ''
  const number = place.number ? `${place.type === 'BUS_STOP' ? '정류장 번호' : '역 번호'} ${place.number}` : ''
  return [place.name, place.line, number].filter(Boolean).join(' · ')
}

// 브라우저가 위치를 주지 못한 이유 (api/real/location.js 의 readPosition 이 돌려주는 값) → 설정 화면 문장
const GEO_REASON_TEXT = Object.freeze({
  NO_GEOLOCATION: '이 브라우저에서는 위치를 쓸 수 없습니다 (https 주소나 localhost 에서만 됩니다)',
  PERMISSION_DENIED: '브라우저에서 위치 사용이 허용되지 않았습니다',
  POSITION_UNAVAILABLE: '위치를 알 수 없습니다',
  TIMEOUT: '시간 안에 위치를 받지 못했습니다',
})

/** 서버가 믿는 오차 한계 (stt/config.yaml 의 rag.location.max_accuracy_m 기본값). 이보다 크면 고정 위치를 쓴다 */
export const ACCURACY_LIMIT_M = 1000

/** readPosition 결과 → '지금 위치 확인' 의 결과 문장 */
export function positionText({ position, reason }) {
  if (!position) return `위치를 받지 못했습니다: ${GEO_REASON_TEXT[reason] ?? GEO_REASON_TEXT.POSITION_UNAVAILABLE}`
  if (position.accuracy === null || position.accuracy === undefined) return '위치를 받았습니다 (오차는 알 수 없습니다)'
  const meters = Math.round(position.accuracy).toLocaleString('ko-KR')
  return position.accuracy > ACCURACY_LIMIT_M
    ? `위치를 받았지만 오차가 약 ${meters} m 입니다. 오차가 ${ACCURACY_LIMIT_M.toLocaleString('ko-KR')} m 를 넘으면 쓰지 않고 고정 위치를 씁니다. 직접 지정해 주세요.`
    : `위치를 받았습니다 (오차 약 ${meters} m). 가장 가까운 역·정류장으로 맞춰집니다.`
}
