// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://hallowmuyi.space',
  integrations: [
    sitemap({
      // 后台不出现在站点地图里
      serialize: (item) => (item.url.includes('/admin') ? undefined : item),
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
