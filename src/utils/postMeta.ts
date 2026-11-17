// 统计中文字符 + 英文单词数，估算阅读时长（中文约 400 字/分钟）
export function postMeta(body: string): { words: number; minutes: number } {
  const text = body
    .replace(/```[\s\S]*?```/g, '') // 去掉代码块
    .replace(/[#>*`\-\[\]()!|]/g, '') // 去掉 markdown 符号
    .replace(/https?:\/\/\S+/g, '');
  const cjk = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const latinWords = (text.match(/[a-zA-Z0-9]+/g) || []).length;
  const words = cjk + latinWords;
  const minutes = Math.max(1, Math.round(words / 400));
  return { words, minutes };
}

/** 把 YYYY-MM-DD 解析成 UTC 零点，避免本地时区把日期挪一天 */
export function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function formatDate(value: Date | string): string {
  return (typeof value === 'string' ? value : value.toISOString()).slice(0, 10);
}

/** MM-DD，用于首页任务日志这类紧凑展示 */
export function monthDay(value: string): string {
  return value.slice(5, 10);
}

export function yearOf(value: string): number {
  return Number(value.slice(0, 4));
}

/** ISO 时间转北京时间 `YYYY-MM-DD HH:mm`，用于评论时间 */
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const shifted = new Date(date.getTime() + 8 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(
    shifted.getUTCHours()
  )}:${pad(shifted.getUTCMinutes())}`;
}
