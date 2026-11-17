import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

/** 把数据库里的 Markdown 原文渲染成 HTML。 */
export function renderMarkdown(markdown: string): string {
  return marked.parse(markdown ?? '', { async: false }) as string;
}
