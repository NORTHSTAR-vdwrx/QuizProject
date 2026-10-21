import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        home: fileURLToPath(new URL('./home/index.html', import.meta.url)),
        quiz: fileURLToPath(new URL('./quiz/index.html', import.meta.url)),
        results: fileURLToPath(new URL('./results/index.html', import.meta.url))
      }
    }
  }
});