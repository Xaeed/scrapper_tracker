export function isHtmlCvContent(text: string): boolean {
  const t = text.trim()
  return t.startsWith('<') || /<\s*html[\s>]/i.test(t.slice(0, 500))
}
