import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages 프로젝트 사이트는 /<repo-name>/ 하위 경로로 서빙되므로 base를 맞춰준다.
  // Electron 빌드는 file:// 로 직접 열리므로 절대경로 base를 쓰면 흰 화면만 뜬다 - 상대경로로.
  base: mode === 'electron' ? './' : '/inning-roll/',
  plugins: [react(), tailwindcss()],
}))
