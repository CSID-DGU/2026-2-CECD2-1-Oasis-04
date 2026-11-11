// 서버의 목적지 후보 한 개를 화면이 쓰는 Poi { id, name, category } 로 바꾼다. resolve.js 와 pois.js 가 함께 쓴다.
//
// 서버 후보: { poi_id, name, display_name, poi_type, x, y, distance_m, score }
//   지하철역  display_name '선릉역 (2호선)'      → name '선릉역',      category '지하철 2호선'
//   버스정류장 display_name '경동시장앞 정류장'    → name '경동시장앞',   category '버스정류장'
//   그 외     → name display_name, category '시설'
// 화면은 "이름 (category)" 로 그리므로 괄호가 겹치지 않게 노선 정보는 category 쪽으로 옮긴다.
// 좌표·점수는 화면이 쓰지 않지만 /route 연동과 디버깅을 위해 그대로 실어 둔다.

export function toPoi(c) {
  const display = c.display_name ?? c.name ?? ''
  let name = display
  let category = '시설'

  if (c.poi_type === 'SUBWAY_STATION') {
    const m = display.match(/^(.*?)\s*\((.*)\)\s*$/)
    name = m ? m[1] : display
    category = m && m[2] ? `지하철 ${m[2]}` : '지하철역'
  } else if (c.poi_type === 'BUS_STOP') {
    name = c.name ?? display
    category = '버스정류장'
  }

  return {
    id: c.poi_id,
    name,
    category,
    x: c.x,
    y: c.y,
    distanceM: c.distance_m ?? null,
    score: c.score ?? null,
  }
}
