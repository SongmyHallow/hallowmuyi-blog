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

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
