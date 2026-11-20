// 키오스크 위치 설정(settings/kioskPlace.js)과, 그 설정이 위치 조회(api/real/location.js)에 쓰이는지 테스트.
// 환경: node (fetch 와 localStorage 를 가짜로 바꿔 끼운다)

import { describe, it, expect, vi, afterEach } from 'vitest'
import { AUTO, PLACE_KEY, placeText, positionText, readKioskPlace, writeKioskPlace } from '../kioskPlace.js'
import { findPlaces, getLocation } from '../../api/real/location.js'

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return { getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k), data }
}

const JONGNO = { poiId: 'SUB_0130_1호선', name: '종로3가역', type: 'SUBWAY_STATION', number: '130', line: '1호선' }
const TAPGOL = { poiId: 'BUS_100000002', name: '종로3가.탑골공원 정류장', type: 'BUS_STOP', number: '01-010', line: '' }
const ok = (data) => ({ success: true, data, latency_ms: 1 })

describe('위치 설정 저장', () => {
  it('저장된 것이 없거나 깨져 있으면 자동이다', () => {
    expect(readKioskPlace(fakeStorage())).toEqual(AUTO)
    expect(readKioskPlace(fakeStorage({ [PLACE_KEY]: '{깨진 값' }))).toEqual(AUTO)
    expect(readKioskPlace(fakeStorage({ [PLACE_KEY]: JSON.stringify({ mode: 'manual', place: {} }) }))).toEqual(AUTO)
    expect(readKioskPlace(null)).toEqual(AUTO)
  })
  it('직접 정한 곳을 저장하고 다시 읽는다. 자동으로 되돌리면 지운다', () => {
    const storage = fakeStorage()
    expect(writeKioskPlace({ mode: 'manual', place: JONGNO }, storage)).toBe(true)
    expect(readKioskPlace(storage)).toEqual({ mode: 'manual', place: JONGNO })
    expect(writeKioskPlace({ mode: 'auto' }, storage)).toBe(true)
    expect(storage.data.has(PLACE_KEY)).toBe(false)
  })
  it('직접 정하기로 했는데 고른 곳이 없거나 저장소가 없으면 저장하지 못한다', () => {
    expect(writeKioskPlace({ mode: 'manual', place: null }, fakeStorage())).toBe(false)
    expect(writeKioskPlace({ mode: 'manual', place: JONGNO }, null)).toBe(false)
  })
})

describe('화면에 보일 글', () => {
  it('고른 곳 한 줄', () => {
    expect(placeText(JONGNO)).toBe('종로3가역 · 1호선 · 역 번호 130')
    expect(placeText(TAPGOL)).toBe('종로3가.탑골공원 정류장 · 정류장 번호 01-010')
    expect(placeText({ poiId: 'x', name: '어느 역', type: 'SUBWAY_STATION', number: '', line: '' })).toBe('어느 역')
    expect(placeText(null)).toBe('')
  })
  it('지금 위치 확인: 오차가 크면 직접 지정하라고 알린다', () => {
    expect(positionText({ position: { x: 127, y: 37.5, accuracy: 5234 }, reason: null })).toContain('오차가 약 5,234 m 입니다')
    expect(positionText({ position: { x: 127, y: 37.5, accuracy: 5234 }, reason: null })).toContain('직접 지정해 주세요')
    expect(positionText({ position: { x: 127, y: 37.5, accuracy: 35 }, reason: null })).toBe('위치를 받았습니다 (오차 약 35 m). 가장 가까운 역·정류장으로 맞춰집니다.')
    expect(positionText({ position: null, reason: 'PERMISSION_DENIED' })).toBe('위치를 받지 못했습니다: 브라우저에서 위치 사용이 허용되지 않았습니다')
    expect(positionText({ position: null, reason: 'NO_GEOLOCATION' })).toContain('이 브라우저에서는 위치를 쓸 수 없습니다')
  })
})

describe('real API 와 이어지는 부분', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
  const respond = (body) => {
    const fetchFn = vi.fn(async () => ({ status: 200, json: async () => body }))
    vi.stubGlobal('fetch', fetchFn)
    return fetchFn
  }

  it('findPlaces: 찾는 말을 서버에 보내고 화면 모양으로 바꾼다', async () => {
    const fetchFn = respond(ok({ places: [{ poi_id: 'SUB_0130_1호선', name: '종로3가역', poi_type: 'SUBWAY_STATION', number: '130', line: '1호선', x: 126.99, y: 37.57 }] }))
    expect(await findPlaces('종로3가')).toEqual([JONGNO])
    expect(fetchFn.mock.calls[0][0]).toBe(`/api/v1/places?q=${encodeURIComponent('종로3가')}`)
  })
  it('findPlaces: 서버가 실패를 알리면 throw 한다', async () => {
    respond({ success: false, error: { code: 'MODEL_NOT_READY', message: 'kb loading', easy_message: '준비 중이에요.' } })
    await expect(findPlaces('130')).rejects.toThrow('준비 중이에요')
  })

  it('직접 정해 둔 곳이 있으면 브라우저 위치를 읽지 않고 그곳의 id 를 서버에 알린다', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal('localStorage', fakeStorage({ [PLACE_KEY]: JSON.stringify({ mode: 'manual', place: JONGNO }) }))
    const getCurrentPosition = vi.fn()
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    const fetchFn = respond(
      ok({ source: 'MANUAL', name: '종로3가역', x: 126.9918, y: 37.5704, snapped: true, fallback_reason: null, easy_text: '지금 계신 곳: 종로3가역', place: { type: 'SUBWAY_STATION', name: '종로3가역', lines: [] } }),
    )
    const result = await getLocation()
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({ kiosk_id: 'KIOSK_JONGNO_01', poi_id: 'SUB_0130_1호선' })
    expect(result).toMatchObject({ name: '종로3가역', source: 'MANUAL', reason: null, snapped: true })
  })
  it('정해 둔 곳을 서버가 모르면 고정 위치와 그 이유를 돌려준다', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal('localStorage', fakeStorage({ [PLACE_KEY]: JSON.stringify({ mode: 'manual', place: JONGNO }) }))
    respond(ok({ source: 'KIOSK', name: '종로3가역', fallback_reason: 'PLACE_NOT_FOUND', easy_text: '지금 계신 곳: 종로3가역' }))
    expect(await getLocation()).toMatchObject({ source: 'KIOSK', reason: 'PLACE_NOT_FOUND' })
  })
})
