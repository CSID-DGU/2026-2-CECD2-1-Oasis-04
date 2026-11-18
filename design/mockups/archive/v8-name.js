// 역명판 이름 규칙 (시안 v8). 기준: docs/design-guidelines.md 7절 '역명판 이름'.
// 이 파일은 손으로 쓴 것이다 (build-v8.mjs 가 만들지 않는다). v8-band.js 보다 먼저 불러온다.
//
// 규칙 (위에서부터 차례로 적용한다)
//   1. 이름은 항상 한 줄이다. 줄을 바꾸지 않고, 말줄임표로 자르지도 않는다
//   2. 화면에 그릴 때만 지하철역 이름 끝의 "역", 버스정류장 이름 끝의 "정류장"을 뗀다. 데이터는 그대로다
//   3. 이름 상자는 좌우 요소(노선 번호 원, 앞뒤 역 이름, 버스 종류, 버스 번호)와 겹치지 않는 너비까지만 넓어진다.
//      넘으면 글씨를 기본 크기(--place-name-size)에서 최소 크기(--place-name-min, 72px)까지 한 단계(--place-name-step, 8px)씩 줄인다
//   4. 최소 크기에서도 넘치면 오른쪽 버스 번호를 줄인다: 가장 왼쪽까지 나온 줄부터, 뒤쪽 번호를 하나씩 숨긴다
//      (종류마다 앞에서부터 들어가는 만큼만 남는다). 그래도 넘치면 좌우 요소를 모두 숨긴다
//   5. 띠와 이름 상자의 높이는 한 줄 기준으로 고정이다 (v8.css 의 --plate-height). 이 함수는 높이를 건드리지 않는다

const PLACE_NAME_MARGIN = 40 // 이름 상자와 좌우 요소 사이에 남기는 여유 (px)

/** 화면에 보일 이름. 데이터의 이름에서 끝의 "역" / "정류장"만 뗀다 (규칙 2). */
function displayPlaceName(place) {
  if (place.type === 'SUBWAY_STATION') return place.name.replace(/\s*역$/, '')
  if (place.type === 'BUS_STOP') return place.name.replace(/\s*정류장$/, '')
  return place.name
}

/**
 * 띠(.v8-band) 하나를 받아 이름 크기를 정한다 (규칙 3, 4). 이름을 넣은 뒤, 글꼴을 읽은 다음에 부른다.
 * 돌려주는 값: { size: 정해진 글씨 크기(px), hiddenNumbers: 숨긴 버스 번호 수, marksHidden: 좌우 요소를 모두 숨겼는지, fits: 들어갔는지 }
 * 실제 앱에서는 React 부품 안에서 같은 차례로 계산하면 된다 (너비는 캔버스의 measureText 나 화면 밖 요소로 잰다).
 */
function fitPlaceName(band) {
  const box = band.querySelector('.v8-plate')
  const name = box.querySelector('.v8-name')
  const result = { size: null, hiddenNumbers: 0, marksHidden: false, fits: true }
  if (!name || name.classList.contains('is-waiting')) return result

  const style = getComputedStyle(band)
  const px = (token, fallback) => parseFloat(style.getPropertyValue(token)) || fallback
  const base = parseFloat(getComputedStyle(name).fontSize)
  const min = Math.min(base, px('--place-name-min', 72))
  const step = px('--place-name-step', 8)

  const bandBox = band.getBoundingClientRect()
  const center = bandBox.width / 2
  const visible = (el) => el.style.display !== 'none'
  const leftMarks = () => [...band.querySelectorAll('.v8-circle.is-badge, .v8-tag.is-left, .v8-tag.is-edge')].filter(visible)
  const rightMarks = () => [...band.querySelectorAll('.v8-tag.is-right, .v8-nums')].filter(visible)
  /** 이름 상자가 가질 수 있는 너비의 절반: 화면 가운데에서 가장 가까운 좌우 요소까지의 거리 − 여유 */
  const halfLimit = () => {
    const left = Math.max(0, ...leftMarks().map((m) => m.getBoundingClientRect().right - bandBox.left))
    const right = Math.min(bandBox.width, ...rightMarks().map((m) => m.getBoundingClientRect().left - bandBox.left))
    return Math.min(center - left, right - center) - PLACE_NAME_MARGIN
  }
  const fits = () => box.getBoundingClientRect().width / 2 <= halfLimit()

  // 규칙 3: 기본 크기에서 최소 크기까지 한 단계씩 줄인다
  let size = base
  name.style.fontSize = `${size}px`
  while (!fits() && size > min) {
    size = Math.max(min, size - step)
    name.style.fontSize = `${size}px`
  }
  result.size = size

  // 규칙 4-1: 버스 번호를 줄인다. 가장 왼쪽까지 나온 줄에서 맨 뒤 번호를 하나씩 숨긴다
  while (!fits()) {
    const rows = [...band.querySelectorAll('.v8-nums')]
      .map((row) => ({ row, shown: [...row.children].filter(visible) }))
      .filter(({ shown }) => shown.length > 0)
    if (rows.length === 0) break
    const widest = rows.reduce((a, b) => (a.row.getBoundingClientRect().left <= b.row.getBoundingClientRect().left ? a : b))
    widest.shown.at(-1).style.display = 'none'
    if (widest.shown.length === 1) widest.row.style.display = 'none'
    result.hiddenNumbers += 1
  }

  // 규칙 4-2: 그래도 넘치면 좌우 요소를 모두 숨긴다
  if (!fits()) {
    ;[...leftMarks(), ...rightMarks()].forEach((m) => (m.style.display = 'none'))
    result.marksHidden = true
  }

  result.fits = fits()
  band.dataset.placeName = JSON.stringify(result) // 검사할 때 읽으려고 남긴다
  return result
}
