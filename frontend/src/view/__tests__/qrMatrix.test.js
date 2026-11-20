import { describe, it, expect } from 'vitest'
import { qrMatrix, quietModules } from '../qrMatrix.js'

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

  it('둘레 여백은 칸 4개 이상, 칸이 많으면 시안 비율(그림의 1/12)', () => {
    expect(quietModules(25)).toBe(4)
    expect(quietModules(48)).toBe(4)
    expect(quietModules(60)).toBe(5)
    expect(qrMatrix('https://example.com/r/route-a').quiet).toBeGreaterThanOrEqual(4)
  })

  it('긴 주소(카카오맵 길찾기 주소 길이)도 만든다', () => {
    const url = 'https://map.kakao.com/link/by/traffic/' + '종로3가역,37.5704,126.9921/명동역,37.5609,126.9863'
    expect(qrMatrix(url).size).toBeGreaterThan(21)
  })
})
