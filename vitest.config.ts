import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    testTimeout: 120000,
    hookTimeout: 120000,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environmentMatchGlobs: [
      ['src/**/*.test.tsx', 'jsdom'],
    ],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/lib/supabase.types.ts',
        'src/lib/engine/wasm/**',
        'src/lib/supabase/client.ts',
        'src/lib/supabase/server.ts',
        'src/lib/supabase/middleware.ts',
        'src/lib/supabase/types.ts',
        'src/lib/postflop/hooks/**',
        'src/lib/v2/hooks/**',
        'src/lib/range/context.ts',
        'src/lib/ui/toastContext.tsx',
        'src/lib/ui/ToastContainer.tsx',
        'src/lib/engine/solverCacheDb.ts',
        'src/lib/postflop/api/**',
        'src/lib/postflop/session/postflopSession.tsx',
        'src/lib/postflop/types.ts',
        'src/lib/stats/types.ts',
        'src/lib/ui/pageTransition.ts',
        'src/lib/audio/**',
        'src/lib/range/index.ts',
        'src/lib/range/types.ts',
        'src/lib/solver/index.ts',
        'src/lib/solver/evaluation/index.ts',
        'src/lib/engine/solverTypes.ts',
        'src/lib/v2/config/types.ts',
        'src/lib/v2/api/sessionHandlers.ts',
        'src/components/**',
        'src/app/**',
      ],
    },
  },
});
