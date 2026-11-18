import { defineMiddleware } from 'astro:middleware';

// 页面 HTML 的边缘缓存：内容改动最多 CACHE_TTL 秒后生效。
// 管理员（带 hm_admin cookie）始终绕过缓存，保存后立刻能看到最新内容。
const CACHE_TTL_SECONDS = 60;
const CACHE_PATH_EXCLUDES = ['/api/', '/admin', '/_astro/', '/fonts/'];

// 客户端（浏览器）缓存：短 TTL，配合悬停预取让站内跳转接近瞬时。
// 用 private 是为了不让 Cloudflare 的 CDN 再存一份 —— CDN 的 Browser Cache TTL
// 设置会把 max-age 改写成 4 小时，反而让访客长时间看到旧页面。
const CLIENT_CACHE_CONTROL = `private, max-age=${CACHE_TTL_SECONDS}, stale-while-revalidate=300`;
// 存在 Cache API 里的副本（只在 Worker 内部使用，不会发给客户端）。
const STORE_CACHE_CONTROL = `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`;

// 不要缓存的路径（API、后台、构建产物）；HTML 之外的响应由 Accept 头过滤。
function isCacheablePath(pathname: string) {
  return !CACHE_PATH_EXCLUDES.some((prefix) => pathname.startsWith(prefix));
}

function acceptsHtml(request: Request) {
  return (request.headers.get('accept') ?? '').includes('text/html');
}

function hasAdminSession(request: Request) {
  const cookie = request.headers.get('cookie') ?? '';
  return cookie.includes('hm_admin=');
}

function withClientHeaders(body: BodyInit | null, status: number, source: Headers, xCache: string) {
  const headers = new Headers(source);
  headers.delete('set-cookie');
  headers.set('cache-control', CLIENT_CACHE_CONTROL);
  headers.set('x-cache', xCache);
  return new Response(body, { status, headers });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, url } = context;
  const adminSession = hasAdminSession(request);

  if (
    request.method !== 'GET' ||
    !acceptsHtml(request) ||
    url.pathname === '/admin' ||
    !isCacheablePath(url.pathname) ||
    request.headers.has('authorization')
  ) {
    return next();
  }

  // 管理员请求：绕过缓存并禁止浏览器缓存，保证保存后立刻看到最新内容。
  if (adminSession) {
    const response = await next();
    const headers = new Headers(response.headers);
    headers.set('cache-control', 'private, no-store');
    headers.set('x-cache', 'BYPASS');
    return new Response(response.body, { status: response.status, headers });
  }

  // Cloudflare 的 Cache API（本地 dev 里 workerd 也提供，未提供时自动降级为直出）。
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = new Request(url.toString(), {
    method: 'GET',
    headers: { accept: 'text/html' },
  });

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) {
      return withClientHeaders(hit.body, hit.status, hit.headers, 'HIT');
    }
  }

  const response = await next();

  // 只缓存干净的成功响应；带 Set-Cookie 的一律不缓存。
  if (response.status !== 200 || response.headers.has('set-cookie')) {
    return response;
  }

  const body = await response.arrayBuffer();
  const result = withClientHeaders(body, 200, response.headers, 'MISS');

  if (cache) {
    const stored = new Response(body, {
      status: 200,
      headers: new Headers(response.headers),
    });
    stored.headers.set('cache-control', STORE_CACHE_CONTROL);
    const put = cache.put(cacheKey, stored.clone());
    const cfContext = (context.locals as { cfContext?: { waitUntil(promise: Promise<unknown>): void } })
      .cfContext;
    if (cfContext) cfContext.waitUntil(put);
    else await put;
  }

  return result;
});
