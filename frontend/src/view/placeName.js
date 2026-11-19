// 지금 계신 곳의 이름을 화면에 보일 글자로 바꾼다 (디자인 문서 7절 규칙 2, 시안 idle-band.js 의 displayPlaceName).
// 큰 띠(PlaceBand)와 얇은 띠(ThinBand)가 함께 쓴다. 데이터의 이름은 바꾸지 않고 화면에 그릴 때만 뗀다.
//   지하철역    끝의 "역" 을 뗀다       "종로3가역" → "종로3가"
//   버스정류장  끝의 "정류장" 을 뗀다   "종로3가.탑골공원 정류장" → "종로3가.탑골공원"
//   그 전에 이름 끝의 " 키오스크" 를 먼저 뗀다   "종로3가역 키오스크" → "종로3가" (2026-11-20, 디자인 문서 8절 머리)
// 한 줄 규칙(7절 규칙 1)과 72px 까지 줄이기(규칙 3)는 그리는 쪽 CSS 와 useFitText 가 맡는다.

export const PLACE_TYPES = Object.freeze({ SUBWAY_STATION: 'SUBWAY_STATION', BUS_STOP: 'BUS_STOP' })

/** 장소 정보(8-5절 형식) → 화면에 보일 이름. 종류를 모르면 이름 그대로 */
export function displayPlaceName(place) {
  const name = stripKiosk(place?.name)
  if (!name) return ''
  if (place.type === PLACE_TYPES.SUBWAY_STATION) return name.replace(/\s*역$/, '')
  if (place.type === PLACE_TYPES.BUS_STOP) return name.replace(/\s*정류장$/, '')
  return name
}

/** 이름 끝의 " 키오스크" 를 먼저 뗀다. 서버의 고정 위치 이름이 "종로3가역 키오스크" 처럼 온다 (docs/team-requests.md #1) */
function stripKiosk(name) {
  return (name || '').trim().replace(/\s*키오스크$/, '')
}

/**
 * 큰 띠가 그릴 수 있는 장소인지: 'SUBWAY'(노선이 있는 역) | 'BUS'(버스가 있는 정류장) | null(정보 없음)
 * null 이면 큰 띠는 회색 선 세 줄과 "지금 계신 곳을 확인하고 있어요" 를 보인다 (8-3절, 시안 renderBand)
 */
export function placeKind(place) {
  if (place?.type === PLACE_TYPES.SUBWAY_STATION && place.lines?.length) return 'SUBWAY'
  if (place?.type === PLACE_TYPES.BUS_STOP && place.buses?.length) return 'BUS'
  return null
}

/** 종류를 모를 때 이름 끝으로 짐작한다: "…역" → 지하철역, "…정류장" → 버스정류장, 그 밖은 null(이름 그대로) */
function typeFromName(name) {
  if (/정류장$/.test(name)) return PLACE_TYPES.BUS_STOP
  if (/역$/.test(name)) return PLACE_TYPES.SUBWAY_STATION
  return null
}

/**
 * 위치 조회 결과(api.getLocation) → 얇은 띠에 보일 이름.
 * - 큰 띠가 그릴 수 있는 장소면 그 장소 이름 (끝의 "역"·"정류장" 떼기)
 * - 장소 정보(place)가 없거나 모자라도 이름이 있으면 그 이름을 같은 규칙으로 (2026-11-20, 디자인 문서 8절 머리).
 *   real 서버는 아직 place 를 주지 않지만 name 은 준다 ("종로3가역 키오스크", "경동시장앞 정류장" 등. docs/team-requests.md #1)
 *   종류를 모르면 이름 끝으로 짐작한다
 * - 이름도 없으면 빈 글자
 * 큰 띠는 이 함수를 쓰지 않는다. 장소 정보가 없으면 늘 "지금 계신 곳을 확인하고 있어요" 다 (이름만 있는 큰 띠는 없다)
 */
export function bandPlaceName(location) {
  const place = location?.place
  if (placeKind(place)) return displayPlaceName(place)
  const name = stripKiosk(place?.name || location?.name)
  if (!name) return ''
  return displayPlaceName({ type: place?.type ?? typeFromName(name), name })
}
