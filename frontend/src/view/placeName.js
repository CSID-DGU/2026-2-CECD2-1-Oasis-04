// 지금 계신 곳의 이름을 화면에 보일 글자로 바꾼다 (디자인 문서 7절 규칙 2, 시안 idle-band.js 의 displayPlaceName).
// 큰 띠(PlaceBand)와 얇은 띠(ThinBand)가 함께 쓴다. 데이터의 이름은 바꾸지 않고 화면에 그릴 때만 뗀다.
//   지하철역    끝의 "역" 을 뗀다       "종로3가역" → "종로3가"
//   버스정류장  끝의 "정류장" 을 뗀다   "종로3가.탑골공원 정류장" → "종로3가.탑골공원"
// 한 줄 규칙(7절 규칙 1)과 72px 까지 줄이기(규칙 3)는 그리는 쪽 CSS 와 useFitText 가 맡는다.

export const PLACE_TYPES = Object.freeze({ SUBWAY_STATION: 'SUBWAY_STATION', BUS_STOP: 'BUS_STOP' })

/** 장소 정보(8-5절 형식) → 화면에 보일 이름. 종류를 모르면 이름 그대로 */
export function displayPlaceName(place) {
  if (!place?.name) return ''
  if (place.type === PLACE_TYPES.SUBWAY_STATION) return place.name.replace(/\s*역$/, '')
  if (place.type === PLACE_TYPES.BUS_STOP) return place.name.replace(/\s*정류장$/, '')
  return place.name
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

/**
 * 위치 조회 결과(api.getLocation) → 띠에 보일 이름.
 * 큰 띠가 그릴 수 없는 장소(정보 없음)면 빈 글자다. 큰 띠가 "지금 계신 곳을 확인하고 있어요" 를 보이는 것과 맞춘다
 * (서버가 place 를 주기 전의 real 모드도 같다. docs/team-requests.md #1)
 */
export function bandPlaceName(location) {
  const place = location?.place
  return placeKind(place) ? displayPlaceName(place) : ''
}
