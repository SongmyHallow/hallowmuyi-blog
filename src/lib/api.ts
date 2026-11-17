/** 管理接口共用的小工具：乐观锁、dry-run、查询参数。 */
import { json } from './auth';

export interface IfMatch {
  /** 客户端声明的版本号；null 表示没传（强制覆盖）。 */
  version: string | null;
}

/** 解析 If-Match 头：支持 `"<version>"`、`W/"<version>"` 和裸值。 */
export function readIfMatch(request: Request): IfMatch {
  const raw = request.headers.get('If-Match')?.trim();
  if (!raw) return { version: null };
  const value = raw.replace(/^W\//i, '').replace(/^"|"$/g, '').trim();
  return { version: value || null };
}

/** `?dryRun=1` 或 `X-Dry-Run: 1`：只校验、不落库。 */
export function isDryRun(request: Request): boolean {
  if (request.headers.get('X-Dry-Run') === '1') return true;
  const value = new URL(request.url).searchParams.get('dryRun');
  return value === '1' || value === 'true';
}

export function searchQuery(request: Request): string | undefined {
  return new URL(request.url).searchParams.get('q')?.trim() || undefined;
}

export function isFull(request: Request): boolean {
  const value = new URL(request.url).searchParams.get('full');
  return value === '1' || value === 'true';
}

export function conflict(currentVersion: string): Response {
  return json(
    { error: '内容已被修改，请刷新后重试', code: 'conflict', version: currentVersion },
    { status: 409 }
  );
}

export function preconditionFailed(): Response {
  return json({ error: '记录不存在或版本不匹配', code: 'precondition_failed' }, { status: 412 });
}

/** 宽松读取 JSON body：解析失败返回空对象，交给校验层报错。 */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return data && typeof data === 'object' && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
