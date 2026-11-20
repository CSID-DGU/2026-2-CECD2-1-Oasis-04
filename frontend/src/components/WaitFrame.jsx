// 기다림 화면 5개의 틀 (STARTUP_CHECK, CHECKING, RESOLVING, ROUTING, FAIL_COUNT_CHECK). 버튼 칸이 없다.
// 기준: design/mockups/confirmed/wait-final.html, wait.css, 디자인 문서 10-2·10-3·10-4절.
//   얇은 띠 아래, 화면 가운데에 세로로: 고리 → 머리말(있을 때만) → 큰 글씨(112px, 넘치면 8px 씩 72px 까지) → 안내 한 줄
//   72px 로도 넘치면 줄을 바꿔 고르게 최대 3줄 (10-2절 긴 글 규칙, 말줄임표 없음)
//   고리 가운데 높이는 LISTENING 과 같다(화면 위에서 495px). 가로는 화면 가운데 (10-4절)
//
// props
//   icon       고리 가운데 그림 (RingIcon 이름). countdown 이 있으면 쓰지 않는다
//   label      머리말 (없으면 null)
//   core       큰 글씨
//   sub        안내 한 줄 (없으면 null)
//   countdown  CHECKING 만: { seconds(가운데 숫자), progress(남은 비율 0~1) }. 있으면 호가 돌지 않고 줄어든다

import ThinBand from './ThinBand.jsx'
import Ring from './Ring.jsx'
import { useFitText } from '../hooks/useFitText.js'
import { evenWrapClass } from '../view/textWrap.js'
import './WaitFrame.css'

const CORE_FIT = { start: '--font-wait', min: '--font-wait-min', step: '--font-wait-step', max: '--wait-text-max', wrapAtMin: true }

export default function WaitFrame({ icon = null, label = null, core, sub = null, countdown = null }) {
  const coreRef = useFitText(core, CORE_FIT)
  return (
    <section className="flow wait-frame">
      <ThinBand />
      <div className="flow-body">
        <main className="wait">
          <div className="wait-ring">
            {countdown ? (
              <Ring arc="countdown" progress={countdown.progress}>
                <span className="ring-count">{countdown.seconds}</span>
              </Ring>
            ) : (
              <Ring arc="spin" icon={icon} />
            )}
          </div>
          {label && <p className="wait-label">{label}</p>}
          <h1 ref={coreRef} className={`wait-core ${evenWrapClass(core)} ${label ? '' : 'is-first'}`.trim()}>
            {core}
          </h1>
          {sub && <p className="wait-sub">{sub}</p>}
        </main>
      </div>
    </section>
  )
}
