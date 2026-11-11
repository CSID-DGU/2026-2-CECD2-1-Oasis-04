import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 실제 모드(npm run dev:real)에서 /api 요청을 STT 서버로 넘긴다.
    // 브라우저가 보기에는 화면과 같은 출처라서 서버에 CORS 설정이 없어도 된다. mock 모드에서는 쓰이지 않는다.
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
