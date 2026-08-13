import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Import the engine's live TS source directly rather than requiring a
      // `npm run build` in the root package before every web change. Only
      // the browser-safe barrel (index.ts) is aliased — the fs-based
      // loaders (node.ts) are intentionally unreachable from here.
      'anagram-game-engine': path.resolve(__dirname, '../src/index.ts'),
    },
  },
});
