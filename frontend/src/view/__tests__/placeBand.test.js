// 큰 띠 규칙 (디자인 문서 7절, 8-4절). 시험 데이터는 시안 design/mockups/archive/v9-cases.js 와 확정 시안의 장소 그대로다.
import { describe, it, expect } from 'vitest'
import { displayPlaceName, bandPlaceName, placeKind, startPlaceName } from '../placeName.js'
import {
  BAND,
  bandRows,
  rowYs,
  lineShades,
  contrast,
  nameLimits,
  nameMaxWidth,
  decideHiding,
  chooseNumbers,
  lineSegments,
} from '../placeBand.js'
import { PLACES, BAND_CASES } from '../../api/mock/data/places.js'

const TOKENS = {
  primary: '#0a4a9f',
  bgGroup: '#f2f2f2',
  none: '#dcdcdc',
  textSub: '#444444',
  lineTint: 0.3,
  lineTintSoft: 0.2,
  ringTint: 0.6,
  ringTintSoft: 0.45,
}

describe('displayPlaceName (7절 규칙 2)', () => {
  it('지하철역은 끝의 "역", 버스정류장은 끝의 "정류장" 만 뗀다', () => {
    expect(displayPlaceName(PLACES.subway)).toBe('종로3가')
    expect(displayPlaceName(PLACES.bus)).toBe('종로3가.탑골공원')
    expect(displayPlaceName({ type: 'SUBWAY_STATION', name: '역삼역' })).toBe('역삼')
    expect(displayPlaceName({ type: 'BUS_STOP', name: '정류장앞' })).toBe('정류장앞')
  })
  it('종류를 모르면 그대로, 없으면 빈 글자', () => {
    expect(displayPlaceName({ type: 'FERRY', name: '여의도역' })).toBe('여의도역')
    expect(displayPlaceName(null)).toBe('')
  })
  it('얇은 띠 이름: 장소 정보가 없어도 위치 응답의 이름을 같은 규칙으로, 이름도 없으면 빈 글자', () => {
    expect(bandPlaceName({ name: '종로3가역', place: PLACES.subway })).toBe('종로3가')
    expect(bandPlaceName({ name: '경동시장앞 정류장', place: null })).toBe('경동시장앞')
    expect(bandPlaceName({ name: '청량리역', place: null })).toBe('청량리')
  })

  it('이름 끝의 " 키오스크" 를 먼저 떼고 "역"·"정류장" 을 뗀다 (8절 머리, 2026-11-20)', () => {
    expect(bandPlaceName({ name: '종로3가역 키오스크', place: null })).toBe('종로3가')
    expect(bandPlaceName({ name: '경동시장앞 정류장 키오스크', place: null })).toBe('경동시장앞')
    expect(bandPlaceName({ name: '시청 키오스크', place: null })).toBe('시청')
    expect(bandPlaceName({ name: '  종로3가역키오스크 ' })).toBe('종로3가')
    expect(displayPlaceName({ type: 'SUBWAY_STATION', name: '종로3가역 키오스크' })).toBe('종로3가')
    expect(displayPlaceName({ type: 'BUS_STOP', name: '키오스크 정류장' })).toBe('키오스크')
    expect(bandPlaceName({ name: '키오스크', place: null })).toBe('')
    expect(bandPlaceName({ name: '키오스크앞 정류장', place: null })).toBe('키오스크앞')
  })

  it('타임라인 첫 점 이름은 " 키오스크" 만 떼고 "역"·"정류장" 은 남긴다 (9-1절, 2026-11-20)', () => {
    expect(startPlaceName({ name: '종로3가역 키오스크', place: null })).toBe('종로3가역')
    expect(startPlaceName({ name: '경동시장앞 정류장 키오스크' })).toBe('경동시장앞 정류장')
    expect(startPlaceName({ name: '종로3가역 키오스크', place: { type: 'SUBWAY_STATION', name: '종로3가역', lines: [] } })).toBe('종로3가역')
    expect(startPlaceName({ name: '', place: null })).toBe('')
    expect(startPlaceName(null)).toBe('')
    expect(bandPlaceName({ name: '경동시장앞 정류장 근처' })).toBe('경동시장앞 정류장 근처')
    expect(bandPlaceName({ place: { type: 'SUBWAY_STATION', name: '어딘가역', lines: [] } })).toBe('어딘가')
    expect(bandPlaceName({ name: '', place: null })).toBe('')
    expect(bandPlaceName(null)).toBe('')
    expect(placeKind(PLACES.bus)).toBe('BUS')
  })
})

describe('bandRows: 지하철 (규칙 A·B·C·E)', () => {
  it('종로3가: 노선 3개가 번호순으로 한 줄씩, 앞뒤 역 하나씩', () => {
    const rows = bandRows(PLACES.subway)
    expect(rows.map((r) => r.left.map((m) => m.text))).toEqual([
      ['1', '종각'],
      ['3', '안국'],
      ['5', '광화문'],
    ])
    expect(rows.map((r) => r.right)).toEqual(['종로5가', '을지로3가', '을지로4가'])
    expect(rows[0].token).toBe('--line-seoul-1')
    expect(rows.every((r) => r.left[0].type === 'circle')).toBe(true)
  })
  it('노선 1개·2개: 줄 수 그대로. 배열로 온 앞뒤 역은 가까운 역 하나만', () => {
    expect(bandRows(BAND_CASES.anguk).map((r) => [r.left[1].text, r.right])).toEqual([['경복궁', '종로3가']])
    expect(bandRows(BAND_CASES.chungmuro)).toHaveLength(2)
  })
  it('노선 5개(서울역): 번호 노선 2개는 한 줄씩, 나머지 3개는 셋째 줄 회색 선에 표지만', () => {
    const rows = bandRows(BAND_CASES.seoul)
    expect(rows).toHaveLength(3)
    expect(rows.slice(0, 2).map((r) => r.left[0].text)).toEqual(['1', '4'])
    expect(rows[2].token).toBeNull()
    expect(rows[2].left.map((m) => [m.type, m.text])).toEqual([
      ['linetag', '공항철도'],
      ['linetag', '경의중앙'],
      ['linetag', 'GTX-A'],
    ])
  })
  it('노선이 6개 넘게 모이면 "외 N개 노선"', () => {
    const lines = Array.from({ length: 7 }, (_, i) => ({ lineId: `x-${i}`, label: String(i + 1), prev: 'a', next: 'b' }))
    const rows = bandRows({ type: 'SUBWAY_STATION', name: 'x역', lines })
    expect(rows[2].left.at(-1)).toEqual({ type: 'tag', text: '외 2개 노선' })
  })
  it('종점(오금): 다음 역이 없으면 오른쪽에 "종점"', () => {
    const rows = bandRows(BAND_CASES.ogeum)
    expect(rows[0]).toMatchObject({ right: '종점', endRight: true, endLeft: false })
    expect(rows[1]).toMatchObject({ right: '개롱', endRight: false })
  })
})

describe('bandRows: 버스 (규칙 F·G)', () => {
  it('종로3가.탑골공원: 간선·지선·광역 한 줄씩, 번호 전부 / 개수 후보', () => {
    const rows = bandRows(PLACES.bus)
    expect(rows.map((r) => r.left[0].text)).toEqual(['간선', '지선', '광역'])
    expect(rows[0].choices).toEqual([{ numbers: ['101', '260', '270', '720'] }, { text: '간선 버스 4개' }])
    expect(rows[2].token).toBe('--bus-express')
  })
  it('버스 6종류: 간선·지선 한 줄씩, 나머지는 "그 밖" 줄에 종류 이름과 개수', () => {
    const rows = bandRows(BAND_CASES.busmany)
    expect(rows.map((r) => r.left[0].text)).toEqual(['간선', '지선', '그 밖'])
    expect(rows[2].token).toBeNull()
    expect(rows[2].choices.slice(1)).toEqual([{ text: '광역·순환·마을·심야 버스 32개' }, { text: '버스 32개' }])
  })
  it('모르는 종류도 버리지 않고 "그 밖" 으로, 순서는 간선·지선·광역·순환 다음', () => {
    const rows = bandRows({ type: 'BUS_STOP', name: 'x', buses: [{ kind: 'SHUTTLE', numbers: ['1'] }, { kind: 'TRUNK', numbers: ['2'] }] })
    expect(rows.map((r) => r.left[0].text)).toEqual(['간선', '그 밖'])
    expect(rows[1].token).toBeNull()
  })
  it('정보 없음이면 null', () => {
    expect(bandRows(null)).toBeNull()
    expect(bandRows({ type: 'BUS_STOP', name: 'x', buses: [] })).toBeNull()
  })
})

describe('bandRows: 버스정류장의 앞·다음 정류장 (2026-11-20 추가)', () => {
  it('prev·next 가 오면 첫 줄에 앞 정류장 / 다음 정류장, 아래에 버스 줄', () => {
    const rows = bandRows(BAND_CASES.busway)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({ token: null, left: [{ type: 'tag', text: '종로2가' }], right: '종로4가.종묘', choices: null, endLeft: false, endRight: false })
    expect(rows.slice(1).map((r) => r.left[0].text)).toEqual(['간선', '지선'])
    expect(rows[1].choices[0]).toEqual({ numbers: ['101', '260', '270', '720'] })
  })
  it('버스 줄은 2줄까지: 종류가 3개 이상이면 첫 종류만 한 줄, 나머지는 "그 밖"', () => {
    const rows = bandRows(BAND_CASES.buswaymany)
    expect(rows.map((r) => r.left[0].text)).toEqual(['종로2가', '간선', '그 밖'])
    expect(rows[2].choices.slice(1)).toEqual([{ text: '지선·광역·순환·마을·심야 버스 40개' }, { text: '버스 40개' }])
    const three = bandRows({ ...BAND_CASES.busway, buses: PLACES.bus.buses })
    expect(three.map((r) => r.left[0].text)).toEqual(['종로2가', '간선', '그 밖'])
    expect(three[2].choices[0]).toEqual({ numbers: ['7212', '9301'] })
  })
  it('여기서 출발하거나 끝나는 정류장은 없는 쪽에 "종점"', () => {
    expect(bandRows(BAND_CASES.buswayend)[0]).toMatchObject({ right: '종점', endRight: true, endLeft: false })
    const start = bandRows({ ...BAND_CASES.busway, prev: null })
    expect(start[0]).toMatchObject({ left: [{ type: 'tag', text: '종점' }], right: '종로4가.종묘', endLeft: true, endRight: false })
  })
  it('prev·next 가 둘 다 없으면 예전 그대로 버스 줄만 (3줄까지)', () => {
    expect(bandRows({ ...PLACES.bus, prev: null, next: null })).toEqual(bandRows(PLACES.bus))
    expect(bandRows({ ...PLACES.bus, prev: '', next: undefined })).toHaveLength(3)
  })
  it('버스가 없으면 앞·다음 정류장이 있어도 정보 없음', () => {
    expect(bandRows({ type: 'BUS_STOP', name: 'x', prev: 'a', next: 'b', buses: [] })).toBeNull()
  })
  it('앞·다음 정류장 줄의 선: 종점 쪽은 이름 상자 근처에서 끝난다', () => {
    const rows = bandRows(BAND_CASES.buswayend)
    const segs = lineSegments({ rows, ys: [164.5, 255.5], plateRight: 1300, marksShown: true })
    expect(segs[0]).toMatchObject({ from: 0, to: 1300 + BAND.END_GAP, cap: 'round' })
    expect(segs[0].endTagLeft).toBe(1300 + BAND.END_GAP + BAND.END_TAG_GAP)
    expect(segs[1]).toMatchObject({ from: 0, to: BAND.WIDTH, cap: 'butt', endTagLeft: null })
  })
})

describe('rowYs (규칙 A)', () => {
  it('줄이 몇 개든 같은 간격으로 가운데에', () => {
    expect(rowYs(3, 210)).toEqual([119, 210, 301])
    expect(rowYs(2, 210)).toEqual([164.5, 255.5])
    expect(rowYs(1, 210)).toEqual([210])
  })
})

describe('lineShades (규칙 D·I, 8-4절)', () => {
  it('보통 색은 흰색을 섞어 옅게(0.3), 고리는 0.6', () => {
    expect(lineShades('#ef7c1c', TOKENS)).toEqual({ band: '#fad8bb', ring: '#f5b077', edge: null })
  })
  it('주 버튼과 비슷한 파랑은 -soft 진하기', () => {
    expect(lineShades('#0052a4', TOKENS).band).toBe('#ccdced')
  })
  it('옅은 노랑(순환버스)은 어둡게 한 테두리', () => {
    const s = lineShades('#f2b70a', TOKENS)
    expect(contrast(s.band, TOKENS.bgGroup)).toBeLessThan(1.3)
    expect(s.edge).toBe('#ae8407')
  })
  it('색이 없으면 회색 선', () => {
    expect(lineShades('', TOKENS)).toEqual({ band: '#dcdcdc', ring: '#444444', edge: null })
  })
})

describe('이름 상자 너비 (7절 규칙 3·4)', () => {
  it('좌우 요소에서 40px 떨어지는 반너비. 버스 줄은 오른쪽 300px 를 남긴다', () => {
    expect(nameLimits({ groupsRight: 300, rightTagsLeft: 1700 })).toEqual({ full: 620, noNumbers: 620, noMarks: 872 })
    expect(nameLimits({ groupsRight: 150, hasNumbers: true })).toEqual({ full: 572, noNumbers: 770, noMarks: 872 })
  })
  it('글자 최대 너비 = 상자 너비 - 안쪽 여백. 최소 상자도 안 들어가면 음수', () => {
    expect(nameMaxWidth(620, { plateMin: 400, platePad: 56 })).toBe(1128)
    expect(nameMaxWidth(150, { plateMin: 400, platePad: 56 })).toBe(-1)
  })
  it('다 줄여도 넘치면 버스 번호 → 좌우 요소 순으로 숨긴다', () => {
    const limits = { full: 572, noNumbers: 772, noMarks: 872 }
    expect(decideHiding({ plateWidth: 1100, limits, hasNumbers: true })).toEqual({ numbersHidden: false, marksHidden: false, fits: true })
    expect(decideHiding({ plateWidth: 1500, limits, hasNumbers: true })).toEqual({ numbersHidden: true, marksHidden: false, fits: true })
    expect(decideHiding({ plateWidth: 1700, limits, hasNumbers: true })).toEqual({ numbersHidden: true, marksHidden: true, fits: true })
    expect(decideHiding({ plateWidth: 1800, limits, hasNumbers: true }).fits).toBe(false)
    expect(decideHiding({ plateWidth: 1500, limits: { full: 620, noNumbers: 620, noMarks: 872 }, hasNumbers: false })).toEqual({
      numbersHidden: false,
      marksHidden: true,
      fits: true,
    })
  })
  it('버스 번호: 남은 자리에 들어가는 첫 후보, 없으면 -1', () => {
    // 남은 자리 = 1920 - 48 - 1300 - 40 = 532
    expect(chooseNumbers({ choiceWidths: [500, 250], plateRight: 1300 })).toBe(0)
    expect(chooseNumbers({ choiceWidths: [700, 250], plateRight: 1300 })).toBe(1)
    expect(chooseNumbers({ choiceWidths: [700, 600], plateRight: 1300 })).toBe(-1)
  })
})

describe('lineSegments (규칙 E)', () => {
  const rows = bandRows(BAND_CASES.ogeum)
  it('종점 쪽만 이름 상자 근처에서 끝나고 "종점" 표지는 그 뒤', () => {
    const [a, b] = lineSegments({ rows, ys: [164.5, 255.5], plateRight: 1150, marksShown: true })
    expect(a).toEqual({ y: 164.5, from: 0, to: 1246, cap: 'round', endTagLeft: 1262 })
    expect(b).toEqual({ y: 255.5, from: 0, to: BAND.WIDTH, cap: 'butt', endTagLeft: null })
  })
  it('좌우 요소를 숨기면 종점도 양 끝까지', () => {
    const [a] = lineSegments({ rows, ys: [1, 2], plateRight: 1150, marksShown: false })
    expect(a).toMatchObject({ from: 0, to: BAND.WIDTH, endTagLeft: null })
  })
})
