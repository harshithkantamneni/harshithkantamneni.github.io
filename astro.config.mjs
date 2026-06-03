import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Served at the user-site root https://harshithkantamneni.github.io
// (repo harshithkantamneni.github.io under the matching account harshithkantamneni).
export default defineConfig({
  site: 'https://harshithkantamneni.github.io',
  base: '/',
  integrations: [sitemap()],
  build: {
    format: 'directory',
  },
  trailingSlash: 'ignore',
});
