/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: ['.'] } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
