/** Normalize job tags: trim, lowercase, dedupe, stable order */
export function normalizeTagList(input: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of input) {
    const t = raw.trim().toLowerCase()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export function parseTagsJson(s: string | null | undefined): string[] {
  if (!s || !s.trim()) return []
  try {
    const parsed = JSON.parse(s) as unknown
    if (!Array.isArray(parsed)) return []
    return normalizeTagList(parsed.map(x => String(x)))
  } catch {
    return []
  }
}

export function stringifyTags(tags: string[]): string {
  return JSON.stringify(normalizeTagList(tags))
}
