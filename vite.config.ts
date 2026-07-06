import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: '.',
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 1_000_000_000,
    cssCodeSplit: false,
  },
});
