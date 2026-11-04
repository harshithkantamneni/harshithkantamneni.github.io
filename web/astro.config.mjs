import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://harshithkantamneni.github.io',
  output: 'static',
  build: { format: 'directory', inlineStylesheets: 'always' },
  devToolbar: { enabled: false },
  vite: { server: { fs: { allow: ['..'] } } },
});
