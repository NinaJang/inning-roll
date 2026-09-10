import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 프로젝트 사이트는 /<repo-name>/ 하위 경로로 서빙되므로 base를 맞춰준다.
  base: '/inning-roll/',
  plugins: [react(), tailwindcss()],
})
