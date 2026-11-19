// 띠 오른쪽의 날짜와 시각 ("11월 19일 목요일 오후 2:30"). 시안 design/mockups/shared/v3.js 의 tick 과 같은 글자.
// 크기·자리는 쓰는 쪽(ThinBand.css) 이 정한다.

import { useNow } from '../hooks/useNow.js'

const DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

// eslint-disable-next-line react-refresh/only-export-components -- 글자 만들기를 테스트에서 따로 부른다
export function formatDate(d) {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${DAYS[d.getDay()]}`
}

// eslint-disable-next-line react-refresh/only-export-components -- 위와 같음
export function formatTime(d) {
  const h = d.getHours()
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Clock({ className = '' }) {
  const now = useNow()
  return (
    <div className={className}>
      <span>{formatDate(now)}</span> <span>{formatTime(now)}</span>
    </div>
  )
}
