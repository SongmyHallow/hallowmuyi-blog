/// <reference types="astro/client" />

// Cloudflare D1 的最小类型声明（避免额外引入 @cloudflare/workers-types 与 DOM 类型打架）
interface D1Result<T = Record<string, unknown>> {
  success: boolean;
  results?: T[];
  meta?: { changes?: number; last_row_id?: number };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

interface Env {
  DB: D1Database;
  ADMIN_PASSWORD: string;
  /** 可选：给脚本/agent 用的 Bearer token，设置后可用 Authorization: Bearer <token> 访问管理接口。 */
  API_TOKEN?: string;
}

declare module 'cloudflare:workers' {
  export const env: Env;
}
