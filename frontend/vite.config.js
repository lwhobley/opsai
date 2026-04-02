import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // Treat all .js files as JSX (CRA compatibility)
      include: ['**/*.js', '**/*.jsx'],
    }),
  ],
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'build',
    sourcemap: false,
  },
  define: {
    // CRA compatibility
    'process.env': {},
  },
});
