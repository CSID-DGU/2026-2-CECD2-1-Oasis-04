// 저장소 전체를 http://127.0.0.1:8800/ 으로 보여 주는 작은 정적 서버 (의존성 없음, 개발용).
// compare-shots.js 가 그림 두 장을 같은 출처에서 읽어 픽셀을 비교하려면 file:// 이 아니라 http 로 열어야 한다
// (file:// 로 연 그림은 canvas 에서 픽셀을 읽을 수 없다). 확정 시안(design/mockups/confirmed/*.html)도 여기서 열 수 있다.
// 실행: frontend/ 에서 `node scripts/screens/serve-repo.mjs` (끌 때는 Ctrl+C). 다른 포트: `PORT=8801 node ...`
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const PORT = Number(process.env.PORT ?? 8800)
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const file = normalize(join(ROOT, path))
  if (!file.startsWith(ROOT)) return res.writeHead(403).end()
  try {
    const body = await readFile(path.endsWith('/') ? join(file, 'index.html') : file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(PORT, '127.0.0.1', () => console.log(`저장소 ${ROOT} → http://127.0.0.1:${PORT}/`))
