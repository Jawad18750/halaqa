import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function formatBuildTag(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}Z`
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const buildTag =
    process.env.VITE_BUILD_TAG ||
    (mode === 'production' ? formatBuildTag() : 'dev')

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_BUILD_TAG': JSON.stringify(buildTag),
    },
  }
})
