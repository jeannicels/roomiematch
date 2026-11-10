// Builds the keyless demo as one script. Supabase is swapped for a stub and React comes from a CDN.
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@supabase/supabase-js', replacement: resolve('src/lib/supabaseStub.ts') },
      { find: /^react\/jsx-runtime$/, replacement: resolve('src/lib/jsxShim.ts') },
    ],
  },
  define: { 'import.meta.env.VITE_SUPABASE_URL': '""', 'import.meta.env.VITE_SUPABASE_ANON_KEY': '""', 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist-demo',
    cssCodeSplit: false,
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client'],
      output: {
        format: 'iife',
        globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' },
        entryFileNames: 'app.js',
        assetFileNames: 'app[extname]',
      },
    },
  },
});
