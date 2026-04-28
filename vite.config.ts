import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000,
    host: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        index:  resolve(__dirname, 'index.html'),
        game:   resolve(__dirname, 'game.html'),
      },
    },
  },
});
