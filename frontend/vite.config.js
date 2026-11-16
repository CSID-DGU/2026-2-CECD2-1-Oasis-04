import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 실제 모드(npm run dev:real)에서 화면이 부르는 서버는 둘이다. 주소가 다르면 환경변수로 바꾼다.
//   STT 서버 (stt/api.py)       음성 인식·목적지 해석·현재 위치   기본 http://localhost:8001
//   경로 서버 (server/app.py)   대중교통 경로                     기본 http://localhost:8000
const STT_SERVER = process.env.STT_SERVER_URL || 'http://localhost:8001'
const ROUTE_SERVER = process.env.ROUTE_SERVER_URL || 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 브라우저가 보기에는 화면과 같은 출처라서 서버에 CORS 설정이 없어도 된다. mock 모드에서는 쓰이지 않는다.
    proxy: {
      '/api': { target: STT_SERVER, changeOrigin: true },
      '/routes': { target: ROUTE_SERVER, changeOrigin: true },
    },
  },
})
