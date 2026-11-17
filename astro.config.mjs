// @ts-check
import { defineConfig } from 'astro/config';

import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://hallowmuyi.space',
  // 全站服务端渲染：文章、游戏书架等数据全部在运行时从 D1 读取，
  // 后台保存后立即生效，不再触发整站重新构建。
  output: 'server',
  adapter: cloudflare({
    // 站内图片全部是外链/静态资源，不做构建期图片处理，
    // 避免额外绑定 Cloudflare Images。
    imageService: 'passthrough',
  }),
  // 不使用 Astro 的 session（无需额外 KV 绑定）。
  session: false,
  vite: {
    plugins: [tailwindcss()],
  },
});
