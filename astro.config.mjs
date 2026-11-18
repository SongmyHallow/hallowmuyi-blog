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
  // 鼠标悬停/键盘聚焦时预取内部链接，点击时页面已经在浏览器缓存里。
  // 与 middleware 的边缘缓存配合，导航体感接近静态站。
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
