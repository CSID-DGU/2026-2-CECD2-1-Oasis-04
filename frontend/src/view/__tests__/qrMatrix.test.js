import { describe, it, expect } from 'vitest'
import { qrMatrix, QUIET_MODULES } from '../qrMatrix.js'

describe('qrMatrix', () => {
  it('주소가 비면 null', () => {
    expect(qrMatrix('')).toBeNull()
    expect(qrMatrix(null)).toBeNull()
  })

  it('짧은 주소는 작은 버전(21~33칸)이고, 칸 수는 4n+17', () => {
    const m = qrMatrix('https://example.com/r/route-a')
    expect(m.size).toBeGreaterThanOrEqual(21)
    expect(m.size).toBeLessThanOrEqual(33)
    expect((m.size - 17) % 4).toBe(0)
  })

  it('왼쪽 위 위치 표시(7×7 바깥 테두리)가 검은 칸이다', () => {
    const { path } = qrMatrix('https://example.com/r/route-a')
    for (let i = 0; i < 7; i++) {
      expect(path).toContain(`M${i} 0h1v1h-1z`)
      expect(path).toContain(`M0 ${i}h1v1h-1z`)
    }
    expect(path).not.toContain('M1 1h1v1h-1z') // 테두리 안쪽 흰 줄
  })

  // 흰 상자 안쪽 560px 에 (칸 수 + 여백 4칸 × 2) 를 그린다. 주소 길이로 25·49·77칸을 만들어 시험한다 (12-5절)
  it.each([
    [1, 25, 16.97, 67.88],
    [101, 49, 9.82, 39.3],
    [341, 77, 6.59, 26.35],
  ])('주소에 %i글자 더함 → %i칸: 여백 늘 4칸, 한 칸 %fpx, 여백 %fpx', (extra, size, cellPx, quietPx) => {
    const m = qrMatrix('https://example.com/r/' + 'a'.repeat(extra))
    expect(m.size).toBe(size)
    expect(m.quiet).toBe(4)
    expect(QUIET_MODULES).toBe(4)
    const cell = 560 / (m.size + m.quiet * 2)
    expect(cell).toBeCloseTo(cellPx, 2)
    expect(cell * m.quiet).toBeCloseTo(quietPx, 1)
  })

  it('긴 주소(카카오맵 길찾기 주소 길이)도 만든다', () => {
    const url = 'https://map.kakao.com/link/by/traffic/' + '종로3가역,37.5704,126.9921/명동역,37.5609,126.9863'
    expect(qrMatrix(url).size).toBeGreaterThan(21)
  })
})
