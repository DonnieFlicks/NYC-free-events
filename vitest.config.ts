import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Only the Express backend lives here; the frontend has its own Vitest setup under frontend/.
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
