// icons/*.svg 를 한 묶음(<symbol>)으로 만들어 b.html 의 SPRITE 표시 사이에 넣는다.
// 실행: design/mockups 에서 `node build-sprite.mjs`. 아이콘을 더하거나 뺀 뒤 다시 실행하면 된다.
// 파일을 따로 불러오지 않고 페이지 안에 넣는 이유: 그래야 글자색(currentColor)을 따라가고,
// 서버 없이 파일을 바로 열어도(file://) 보인다.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('../shared/icons/', import.meta.url)
const page = new URL('./b.html', import.meta.url)

const symbols = readdirSync(dir)
  .filter((name) => name.endsWith('.svg'))
  .map((name) => {
    const svg = readFileSync(new URL(name, dir), 'utf8')
    const viewBox = svg.match(/viewBox="([^"]+)"/)[1]
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    return `      <symbol id="i-${name.replace('.svg', '')}" viewBox="${viewBox}">${inner}</symbol>`
  })

const sprite = `<!--SPRITE:START-->\n    <svg width="0" height="0" style="position:absolute" aria-hidden="true">\n${symbols.join('\n')}\n    </svg>\n    <!--SPRITE:END-->`
const html = readFileSync(page, 'utf8').replace(/<!--SPRITE:START-->[\s\S]*<!--SPRITE:END-->/, sprite)
writeFileSync(page, html)
console.log(`아이콘 ${symbols.length}개를 b.html 에 넣었습니다`)
