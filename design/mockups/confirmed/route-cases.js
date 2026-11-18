// ROUTE_GUIDE 시험 데이터 (route-guide-final.html?case=... 가 쓴다). 2026-11-17
// 모든 시간·버스 번호·출구 번호는 예시다. 지하철 역 순서는 아는 범위에서 맞췄고 공식 자료로 대조하지 않았다.
// 4번(카드 노선 줄)의 경로 D·E 는 카드가 넘치는지 보려고 지어낸 것이라 실제로 가는 길이 아니다.
//
// 구간 = { mode, ... }
//   SUBWAY { lineId, label, via, to }   label 이 2자를 넘으면 번호 없는 노선(공항철도 등)
//   BUS    { kind, number, via, to }
//   WALK   { minutes, to? }             to 가 없으면 같은 역 안에서 걷는다
// 장소 = { name, kind: 'STATION' | 'STOP' | 'PLACE' }   PLACE 는 역·정류장이 아닌 목적지 (서울병원 등)
// 묶음 = { place, routes }   place 는 얇은 띠에 보이는 지금 계신 곳 이름. 시험 데이터는 모두 지하철역(종로3가) 기준이다
;(() => {
  const STATION_PLACE = '종로3가'
  const S = (name) => ({ name, kind: 'STATION' })
  const P = (name) => ({ name, kind: 'STOP' })
  const PL = (name) => ({ name, kind: 'PLACE' })
  const sub = (lineId, label, via, to) => ({ mode: 'SUBWAY', lineId, label, via, to })
  const bus = (kind, number, via, to) => ({ mode: 'BUS', kind, number, via, to })
  const walk = (minutes, to) => ({ mode: 'WALK', minutes, ...(to ? { to } : {}) })

  // 보통 경로 (환승 1회). 다른 경우의 2·3순위로 쓴다
  const A = { id: 'A', durationMin: 12, exit: '6', start: S('종로3가역'), legs: [sub('seoul-3', '3', ['을지로3가', '충무로'], S('충무로역')), walk(3), sub('seoul-4', '4', ['명동'], S('명동역'))] }
  const B = { id: 'B', durationMin: 17, exit: '6', start: S('종로3가역'), legs: [sub('seoul-1', '1', ['종각', '시청', '서울역'], S('서울역')), walk(5), sub('seoul-4', '4', ['회현', '명동'], S('명동역'))] }
  const C = { id: 'C', durationMin: 19, exit: '6', start: S('종로3가역'), legs: [sub('seoul-5', '5', ['을지로4가', '동대문역사문화공원'], S('동대문역사문화공원역')), walk(6), sub('seoul-4', '4', ['충무로', '명동'], S('명동역'))] }

  window.ROUTE_CASES = {
    // 1. 환승 3회 (걷는 구간 포함). 이 경로 하나만 온다 (환승 2회 이하 경로가 없는 경우)
    transfer3: {
      title: '1. 환승 3회',
      routes: [
        {
          id: 'T3', durationMin: 41, start: S('종로3가역'),
          legs: [
            sub('seoul-1', '1', ['종각', '시청', '서울역'], S('서울역')),
            walk(5),
            sub('arex', '공항철도', ['공덕'], S('공덕역')),
            walk(4),
            sub('gyeongui-jungang', '경의중앙', ['서강대'], S('서강대역')),
            walk(3, P('서강대역')),
            bus('BRANCH', '7016', ['신촌오거리.현대백화점', '연세대앞'], P('연세대앞')),
          ],
        },
      ],
    },
    // 2. 경로가 1개만, 2개만
    one: { title: '2-1. 경로 1개', routes: [A] },
    two: { title: '2-2. 경로 2개', routes: [A, B] },
    // 3. 걸어서만 가는 경로 (카카오 응답에는 이런 경로가 없다. 가까우면 앱이 먼저 걸어가라고 안내한다)
    walk: { title: '3. 걸어서만', routes: [{ id: 'W', durationMin: 6, start: S('종로3가역'), legs: [walk(6, PL('탑골공원'))] }] },
    // 4. 카드의 노선 줄이 긴 경우: D 는 환승 3회(① → 405 → ④ → 7011), E 는 환승 2회지만 번호 없는 노선과 긴 버스 번호
    longcard: {
      title: '4. 카드 노선 줄이 긴 경우',
      routes: [
        {
          id: 'D', durationMin: 29, start: S('종로3가역'),
          legs: [
            sub('seoul-1', '1', ['종각', '시청', '서울역'], S('서울역')),
            walk(3, P('서울역')),
            bus('TRUNK', '405', ['숭례문', '회현역'], P('회현역')),
            walk(2, S('회현역')),
            sub('seoul-4', '4', ['명동'], S('명동역')),
            walk(3, P('명동역')),
            bus('BRANCH', '7011', ['명동입구'], P('명동입구')),
          ],
        },
        {
          id: 'E', durationMin: 33, start: S('종로3가역'), // 띠(종로3가)와 맞춘다. 길은 그대로 지어낸 것
          legs: [
            sub('arex', '공항철도', ['공덕'], S('공덕역')),
            walk(4, P('공덕역')),
            bus('EXPRESS', '9401-1', ['마포역', '공덕오거리'], P('공덕오거리')),
            walk(3, S('공덕역')),
            sub('gyeongui-jungang', '경의중앙', ['서강대'], S('서강대역')),
          ],
        },
        A,
      ],
    },
    // 5. 긴 이름: 동대문역사문화공원역에서 갈아타고 긴 정류장 이름에서 내린다
    longname: {
      title: '5. 긴 이름',
      routes: [
        {
          id: 'L', durationMin: 27, start: S('종로3가역'),
          legs: [
            sub('seoul-5', '5', ['을지로4가', '동대문역사문화공원'], S('동대문역사문화공원역')),
            walk(4, P('동대문역사문화공원역.국립중앙의료원')),
            bus('EXPRESS', '9401-1', ['신당역.중앙시장앞', '서울특별시립중부노인전문요양원앞'], P('서울특별시립중부노인전문요양원앞')),
          ],
        },
        A,
        B,
      ],
    },
    // 6. 번호 없는 노선 (공항철도, 경의중앙선)
    named: {
      title: '6. 번호 없는 노선',
      routes: [
        { id: 'N1', durationMin: 24, exit: '1', start: S('종로3가역'), legs: [sub('seoul-5', '5', ['광화문', '서대문', '충정로', '애오개', '공덕'], S('공덕역')), walk(4), sub('gyeongui-jungang', '경의중앙', ['서강대'], S('서강대역'))] },
        { id: 'N2', durationMin: 22, exit: '1', start: S('종로3가역'), legs: [sub('seoul-1', '1', ['종각', '시청', '서울역'], S('서울역')), walk(5), sub('arex', '공항철도', ['공덕'], S('공덕역'))] },
        A,
      ],
    },
    // 7. 목적지가 역이 아닌 장소. 내리는 역에서 걸어간다
    place: {
      title: '7. 목적지가 장소',
      routes: [
        { ...A, id: 'A7', durationMin: 17, legs: [...A.legs, walk(5, PL('서울병원'))] },
        { ...B, id: 'B7', durationMin: 22, legs: [...B.legs, walk(5, PL('서울병원'))] },
      ],
    },
    // 9. 탈것 3개가 모두 긴 이름 (카드 노선 줄이 두 줄에 들어가는지). 실제 길이 아니다
    longthree: {
      title: '9. 탈것 3개 모두 긴 이름',
      routes: [
        {
          id: 'LT', durationMin: 38, start: S('종로3가역'), // 띠(종로3가)와 맞춘다. 길은 그대로 지어낸 것
          legs: [
            sub('arex', '공항철도', ['공덕'], S('공덕역')),
            walk(4, P('공덕역')),
            bus('EXPRESS', '9401-1', ['마포역', '공덕오거리'], P('공덕오거리')),
            walk(3, S('공덕역')),
            sub('gyeongui-jungang', '경의중앙선', ['서강대'], S('서강대역')),
          ],
        },
        A,
        B,
      ],
    },
    // 8. 출구 번호가 없다
    noexit: { title: '8. 출구 번호 없음', routes: [{ ...A, id: 'A8', exit: null }, B] },
  }
  // 모든 시험 데이터의 띠 이름은 지하철역
  Object.values(window.ROUTE_CASES).forEach((c) => (c.place = STATION_PLACE))

  // 지하철역 기본 묶음 (route-guide-final.html?set=subway): 종로3가역 → 명동역 3개
  window.ROUTE_SUBWAY = { place: STATION_PLACE, routes: [A, B, C] }
})()
