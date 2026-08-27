import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works when served from a subpath,
  // e.g. a GitHub Pages project site at https://<user>.github.io/<repo>/.
  base: './',
})
