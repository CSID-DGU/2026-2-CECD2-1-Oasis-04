// 아이콘 SVG 파일을 읽어 부품(Icon, RingIcon)이 그릴 수 있는 모양으로 바꾼다.
// 파일은 src/assets/icons/ 에 있다 (디자인 문서 3-7절: CDN 을 쓰지 않고 SVG 를 페이지 안에 넣는다).
//   *.svg        Material Symbols (Apache 2.0, 같은 폴더의 LICENSE.txt). logo.svg 는 서비스 로고(임시, 이 팀이 그림)
//   ring/*.svg   고리 가운데 손 그림 (152 칸, 선 굵기는 RingIcon.css). 이 팀이 그림
//
// import.meta.glob: Vite 가 빌드할 때 폴더의 파일을 모두 문자열(?raw)로 넣어 준다. 실행 중에 파일을 따로 받지 않는다.
// (Spring 으로 치면 classpath 리소스를 시작할 때 한 번에 읽어 두는 것)

const MATERIAL = import.meta.glob('../assets/icons/*.svg', { query: '?raw', import: 'default', eager: true })
const RING = import.meta.glob('../assets/icons/ring/*.svg', { query: '?raw', import: 'default', eager: true })

/** 파일 이름(확장자 빼고) → { viewBox, fill, stroke, inner } */
function parseAll(files) {
  const out = {}
  for (const [path, raw] of Object.entries(files)) {
    const name = path.split('/').pop().replace(/\.svg$/, '')
    const open = raw.match(/<svg\b([^>]*)>/)
    const attr = (key) => open?.[1].match(new RegExp(`\\b${key}="([^"]*)"`))?.[1] ?? null
    const innerStart = raw.indexOf('>', raw.indexOf('<svg')) + 1
    out[name] = {
      viewBox: attr('viewBox'),
      fill: attr('fill'),
      stroke: attr('stroke'),
      inner: raw.slice(innerStart, raw.lastIndexOf('</svg>')).trim(),
    }
  }
  return Object.freeze(out)
}

export const MATERIAL_ICONS = parseAll(MATERIAL)
export const RING_DRAWINGS = parseAll(RING)

/** 고리 안 그림 중 손 그림이 아닌 것: 이름 → Material 파일 이름 (시계, 디자인 문서 12-3절) */
export const RING_FROM_MATERIAL = Object.freeze({ clock: 'schedule' })

/** Icon 이 그릴 수 있는 이름 */
export const ICON_NAMES = Object.freeze(Object.keys(MATERIAL_ICONS))

/** RingIcon 이 그릴 수 있는 이름 */
export const RING_ICON_NAMES = Object.freeze([...Object.keys(RING_DRAWINGS), ...Object.keys(RING_FROM_MATERIAL)])
