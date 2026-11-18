// v10(확정판) 시험 페이지를 v9 페이지에서 만든다. 실행: design/mockups 에서 `node build-v9.mjs && node build-v10.mjs`
//   v10-test.html     v8 모양 + v9 의 규칙 (v10-band.js, v10-extra.css). 주소에 ?case=seoul, ?strong=1(진한 선)
//   v10-reduced.html  IDLE_REDUCED. 주소에 ?fq=120 을 붙이면 질문 글씨 크기를 바꿔 볼 수 있다
import { readFileSync, writeFileSync } from 'node:fs'

function convert(source) {
  let html = readFileSync(source, 'utf8')
  const swap = (from, to) => {
    if (!html.includes(from)) throw new Error(`${source}: 찾지 못함: ${from.slice(0, 50)}`)
    html = html.split(from).join(to)
  }
  swap('href="v9-extra.css"', 'href="v10-extra.css"')
  swap('src="v9-band.js"', 'src="v10-band.js"')
  swap(
    "      // 주소에 ?soft=1 을 붙이면 노선 선을 예전의 옅은 색으로 보여 준다 (v9-extra.css. 기본은 진한 선)\n      if (new URLSearchParams(location.search).has('soft')) document.documentElement.classList.add('is-soft-lines')\n",
    "      // 주소에 ?strong=1 을 붙이면 노선 선을 한 단계 진하게 보여 준다 (프로젝터용. v10-extra.css. 기본은 옅은 선)\n      if (new URLSearchParams(location.search).has('strong')) document.documentElement.classList.add('is-strong-lines')\n      // 주소에 ?fq=120 을 붙이면 질문 글씨 크기(--font-question)를 그 값(px)으로 바꿔 보여 준다\n      const fq = new URLSearchParams(location.search).get('fq')\n      if (fq) document.documentElement.style.setProperty('--font-question', Number(fq) + 'px')\n",
  )
  return html.replace('(build-v9.mjs 가 v8-subway.html 에서 만든 파일)', '(build-v10.mjs 가 v9 페이지에서 만든 파일)')
}

writeFileSync('v10-test.html', convert('v9-test.html').replace(/<title>[^<]*<\/title>/, '<title>시안 v10. v8 모양 + 띠 규칙 + 시험 데이터</title>'))
writeFileSync('v10-reduced.html', convert('v9-reduced.html').replace(/<title>[^<]*<\/title>/, '<title>시안 v10. IDLE_REDUCED (음성을 쓸 수 없을 때)</title>'))
console.log('v10-test.html, v10-reduced.html 을 만들었습니다')
