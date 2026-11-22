// 음성 안내가 읽을 문장 (2026-11-22). 화면에 보이는 글과 같은 말을 하는지, 경로를 문장으로 제대로 푸는지 본다.
import { describe, it, expect } from 'vitest'
import {
  busSpoken,
  confirmSpeech,
  countWord,
  qrSpeech,
  reaskSpeech,
  routeSpeech,
  sinoNumber,
  spoken,
  unavailableSpeech,
  withJosa,
} from '../speechText.js'
import { toRouteView } from '../routeView.js'

const station = (name) => ({ name, kind: 'STATION' })
const stopAt = (name) => ({ name, kind: 'STOP' })
const place = (name) => ({ name, kind: 'PLACE' })

describe('countWord: 세는 말', () => {
  it('1~99 를 우리말로 바꾼다', () => {
    expect([1, 2, 3, 4, 5, 10, 11, 12, 19, 21, 30, 99].map(countWord)).toEqual([
      '한', '두', '세', '네', '다섯', '열', '열한', '열두', '열아홉', '스물한', '서른', '아흔아홉',
    ])
  })
  it('20 은 "스무", 범위 밖은 숫자 그대로', () => {
    expect(countWord(20)).toBe('스무')
    expect(countWord(0)).toBe('0')
    expect(countWord(100)).toBe('100')
  })
})

describe('withJosa: 조사', () => {
  it('을/를 은 받침이 있으면 "을"', () => {
    expect(withJosa('3호선', '을/를')).toBe('3호선을')
    expect(withJosa('공항철도', '을/를')).toBe('공항철도를')
    expect(withJosa('273번 버스', '을/를')).toBe('273번 버스를')
  })
  it('으로/로 는 받침이 없거나 ㄹ 받침이면 "로"', () => {
    expect(withJosa('2호선', '으로/로')).toBe('2호선으로')
    expect(withJosa('공항철도', '으로/로')).toBe('공항철도로')
    expect(withJosa('지하철', '으로/로')).toBe('지하철로')
  })
  it('숫자로 끝나면 읽는 소리로 가린다', () => {
    expect(withJosa('N26', '을/를')).toBe('N26을') // 육
    expect(withJosa('7212', '을/를')).toBe('7212를') // 이
    expect(withJosa('종로01', '으로/로')).toBe('종로01로') // 일 (ㄹ 받침)
  })
})

describe('busSpoken: 버스 번호', () => {
  it('네 자리 이상이면 한 자리씩 읽는다', () => {
    expect(busSpoken('7212')).toBe('칠이일이')
    expect(busSpoken('9401')).toBe('구사공일')
  })
  it('세 자리 이하는 그대로 둔다', () => {
    expect(busSpoken('273')).toBe('273')
    expect(busSpoken('N26')).toBe('N26')
  })
  it('0 으로 시작하면 한 자리씩, 줄표는 "다시"', () => {
    expect(busSpoken('종로01')).toBe('종로공일')
    expect(busSpoken('6002-1')).toBe('육공공이 다시 1')
  })
})

describe('sinoNumber: 한자어로 읽은 수', () => {
  it('십·백·천 앞의 1 은 읽지 않는다', () => {
    expect([0, 6, 10, 11, 12, 20, 101, 110, 273, 1000, 1100, 7212].map(sinoNumber)).toEqual([
      '영', '육', '십', '십일', '십이', '이십', '백일', '백십', '이백칠십삼', '천', '천백', '칠천이백십이',
    ])
  })
  it('만 단위', () => {
    expect(sinoNumber(10000)).toBe('만')
    expect(sinoNumber(12000)).toBe('만이천')
    expect(sinoNumber(250300)).toBe('이십오만삼백')
  })
})

describe('spoken: 목소리에 넘기기 전에 다듬기', () => {
  it('이름 가운데 점은 쉼표로, 문장 끝의 점은 그대로', () => {
    expect(spoken('시청앞.덕수궁 정류장에서 내리세요.')).toBe('시청앞, 덕수궁 정류장에서 내리세요.')
  })
  it('따옴표를 빼고 괄호는 쉼표로 바꾼다', () => {
    expect(spoken('“안국역” 맞나요?')).toBe('안국역 맞나요?')
    expect(spoken('서울역버스환승센터(중)에서 내리세요.')).toBe('서울역버스환승센터, 중에서 내리세요.')
  })
  it('QR 은 "큐알"', () => {
    expect(spoken('QR에 비춰요')).toBe('큐알에 비춰요')
  })
  it('숫자로 적힌 것은 한자어로 읽는다: "6번" 은 "여섯 번" 이 아니라 "육번"', () => {
    expect(spoken('6번 출구로 나가세요.')).toBe('육번 출구로 나가세요.')
    expect(spoken('3호선을 타고 14분쯤 걸려요.')).toBe('삼호선을 타고 십사분쯤 걸려요.')
    expect(spoken('273번 버스를 타세요.')).toBe('이백칠십삼번 버스를 타세요.')
    expect(spoken('1가부터 6가까지 있어요. 약 300미터예요.')).toBe('일가부터 육가까지 있어요. 약 삼백미터예요.')
  })
  it('이름에 붙은 숫자는 띄워서 읽는다', () => {
    expect(spoken('안국역6번출구.인사동문화의거리 정류장')).toBe('안국역 육번출구, 인사동문화의거리 정류장')
    expect(spoken('종로3가역9번출구 정류장에서 종로12번 버스를 타고')).toBe('종로 삼가역 구번출구 정류장에서 종로 십이번 버스를 타고')
  })
  it('"N번째" 만 우리말로 읽는다', () => {
    expect(spoken('2번째 정류장에서 내려요')).toBe('두 번째 정류장에서 내려요')
    expect(spoken('1번째 역')).toBe('첫 번째 역')
    expect(spoken('여섯 번째 역인 청량리역')).toBe('여섯 번째 역인 청량리역')
  })
  it('소수는 "점" 으로, 0 으로 시작하는 숫자는 한 자리씩', () => {
    expect(spoken('1.5킬로미터')).toBe('일 점 오킬로미터')
    expect(spoken('종로02번 버스')).toBe('종로 공이번 버스')
  })
  it('버스 번호를 한 자리씩 바꾼 뒤에 남은 숫자도 글자가 된다', () => {
    expect(spoken(`${busSpoken('6002-1')}번 버스`)).toBe('육공공이 다시 일번 버스')
  })
})

describe('routeSpeech: 경로를 문장으로', () => {
  it('지하철 한 번: 걸리는 시간 → 타고 내리는 곳 → 출구 → 마지막 걷기', () => {
    const route = toRouteView({
      id: 'r1',
      durationMin: 14,
      exit: '3',
      start: station('종로3가역'),
      legs: [
        { mode: 'SUBWAY', lineId: 'seoul-4', label: '4', stops: 2, to: station('혜화역') },
        { mode: 'WALK', minutes: 7, to: place('서울대학교병원') },
      ],
    })
    expect(routeSpeech(route)).toEqual([
      '서울대학교병원까지 14분쯤 걸려요.',
      '갈아타지 않아요.',
      '종로3가역에서 4호선을 타고, 두 번째 역인 혜화역에서 내리세요.',
      '3번 출구로 나가세요.',
      '서울대학교병원까지 걸어서 7분 가세요.',
    ])
  })

  it('먼저 걷고 버스를 탄다: 정류장 이름에 "정류장" 을 붙이되 몇 번째인지 말할 때는 겹치지 않게 한다', () => {
    const route = toRouteView({
      id: 'r2',
      durationMin: 16,
      legs: [
        { mode: 'WALK', minutes: 2, to: stopAt('종로3가.탑골공원') },
        { mode: 'BUS', kind: 'TRUNK', number: '273', stops: 5, to: stopAt('서울대학교병원') },
      ],
    })
    expect(routeSpeech(route)).toEqual([
      '서울대학교병원 정류장까지 16분쯤 걸려요.',
      '갈아타지 않아요.',
      '종로3가.탑골공원 정류장까지 걸어서 2분 가세요.',
      '종로3가.탑골공원 정류장에서 273번 버스를 타고, 다섯 번째 정류장인 서울대학교병원에서 내리세요.',
    ])
  })

  it('갈아탄다: 둘째 차부터는 "…으로 갈아타고", 같은 역 안에서 걷는 구간은 "가서 갈아타세요"', () => {
    const route = toRouteView({
      id: 'r3',
      durationMin: 31,
      start: station('종로3가역'),
      legs: [
        { mode: 'SUBWAY', label: '3', stops: 1, to: station('을지로3가역') },
        { mode: 'WALK', minutes: 4 },
        { mode: 'SUBWAY', label: '2', stops: 3, to: station('시청역') },
        { mode: 'WALK', minutes: 3, to: stopAt('시청앞.덕수궁') },
        { mode: 'BUS', kind: 'BRANCH', number: '7212', stops: 4, to: stopAt('세검정') },
      ],
    })
    expect(routeSpeech(route)).toEqual([
      '세검정 정류장까지 31분쯤 걸려요.',
      '두 번 갈아타요.',
      '종로3가역에서 3호선을 타고, 다음 역인 을지로3가역에서 내리세요.',
      '걸어서 4분 가서 갈아타세요.',
      '을지로3가역에서 2호선으로 갈아타고, 세 번째 역인 시청역에서 내리세요.',
      '시청앞.덕수궁 정류장까지 걸어서 3분 가세요.',
      '시청앞.덕수궁 정류장에서 칠이일이번 버스로 갈아타고, 네 번째 정류장인 세검정에서 내리세요.',
    ])
  })

  it('걸어서만 가는 길에는 갈아타는 말을 하지 않는다', () => {
    const route = toRouteView({ id: 'r4', durationMin: 6, legs: [{ mode: 'WALK', minutes: 6, to: place('탑골공원') }] })
    expect(routeSpeech(route)).toEqual(['탑골공원까지 6분쯤 걸려요.', '탑골공원까지 걸어서 6분 가세요.'])
  })

  it('정거장 수나 걸리는 시간을 모르면 그 말을 뺀다', () => {
    const route = toRouteView({
      id: 'r5',
      start: station('종로3가역'),
      legs: [{ mode: 'SUBWAY', label: '공항철도', to: station('서울역') }, { mode: 'WALK' }],
    })
    expect(routeSpeech(route)).toEqual([
      '서울역까지 가는 길이에요.',
      '갈아타지 않아요.',
      '종로3가역에서 공항철도를 타고, 서울역에서 내리세요.',
      '내려서 걸어서 가세요.',
    ])
  })

  it('출발 장소가 없으면 화면처럼 지금 계신 곳에서 시작한다', () => {
    const route = toRouteView(
      { id: 'r6', durationMin: 9, legs: [{ mode: 'BUS', number: '101', stops: 1, to: stopAt('종로4가.종묘') }] },
      { here: { name: '종로3가.탑골공원 정류장', kind: 'STOP' } },
    )
    expect(routeSpeech(route)[2]).toBe('종로3가.탑골공원 정류장에서 101번 버스를 타고, 다음 정류장인 종로4가.종묘에서 내리세요.')
  })

  it('이용자가 고른 목적지가 있으면 첫 문장은 그 이름으로 말한다 (경로가 내리는 정류장에서 끝나도)', () => {
    const route = toRouteView({
      id: 'r7',
      durationMin: 16,
      start: stopAt('종로3가역9번출구'),
      legs: [{ mode: 'BUS', number: '종로12', stops: 2, to: stopAt('창덕궁') }],
    })
    expect(routeSpeech(route, { destination: '안국역' })).toEqual([
      '안국역까지 16분쯤 걸려요.',
      '갈아타지 않아요.',
      '종로3가역9번출구 정류장에서 종로12번 버스를 타고, 두 번째 정류장인 창덕궁에서 내리세요.',
    ])
  })

  it('경로가 없으면 빈 목록', () => {
    expect(routeSpeech(null)).toEqual([])
  })
})

describe('화면별 문장', () => {
  it('CONFIRMING 후보 하나: 이름을 묻고 누를 버튼을 말한다', () => {
    expect(confirmSpeech({ candidates: [{ id: 'a', name: '종로3가역' }] })).toEqual(['종로3가역, 맞나요?', '맞으면 예를 눌러 주세요.'])
  })
  it('CONFIRMING 후보 여러 개: 화면의 기본 문구와 후보 이름', () => {
    const candidates = [{ name: '종로3가역' }, { name: '종로5가역' }]
    expect(confirmSpeech({ candidates })).toEqual(['가시려는 곳을 하나 골라 주세요.', '종로3가역, 종로5가역.'])
  })
  it('CONFIRMING 서버가 되묻는 질문이 있으면 그것을 읽고, 질문에 이름이 다 있으면 이름을 다시 읽지 않는다', () => {
    const candidates = [{ name: '종로3가역' }, { name: '종로5가역' }]
    expect(confirmSpeech({ candidates, question: '종로 몇 가로 가세요? 1가부터 6가까지 있어요.' })).toEqual([
      '종로 몇 가로 가세요? 1가부터 6가까지 있어요.',
      '종로3가역, 종로5가역.',
      '화면에서 골라 주세요.',
    ])
    expect(confirmSpeech({ candidates, question: '종로3가역과 종로5가역 중 어디로 가세요?' })).toEqual([
      '종로3가역과 종로5가역 중 어디로 가세요?',
      '화면에서 골라 주세요.',
    ])
  })
  it('CONFIRMING 후보가 없으면 화면 문구', () => {
    expect(confirmSpeech({ candidates: [] })).toEqual(['후보 목적지를 찾지 못했어요.'])
  })
  it('REASKING 은 누를 버튼까지 말한다', () => {
    expect(reaskSpeech()).toEqual(['잘 못 알아들었어요.', '다시 말하기를 누르고 한 번 더 말씀해 주세요.'])
  })
  it('UNAVAILABLE 은 이유 문구 그대로', () => {
    expect(unavailableSpeech('가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.')).toEqual(['가까운 곳이라 걸어서 가실 수 있어요. 약 300미터예요.'])
    expect(unavailableSpeech('')).toEqual([])
  })
  it('QR_HANDOFF 는 만들어진 뒤 단계 문구를, 실패하면 그 문구를 읽고, 만드는 중에는 읽지 않는다', () => {
    const steps = ['휴대폰 카메라를 켜요', 'QR에 비춰요', '길 안내가 열려요']
    expect(qrSpeech('ready', { steps })).toEqual(['휴대폰 카메라를 켜요.', 'QR에 비춰요.', '길 안내가 열려요.'])
    expect(qrSpeech('error', { steps, message: 'QR을 만들지 못했어요' })).toEqual(['QR을 만들지 못했어요.'])
    expect(qrSpeech('loading', { steps, message: '만드는 중이에요' })).toEqual([])
  })
})
