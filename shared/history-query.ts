import { normalizeHttpUrl } from './url'

export type HistoryContentType = 'all' | 'text' | 'url' | 'image'

export function normalizeHistoryContentType(value: unknown): HistoryContentType {
  return value === 'text' || value === 'url' || value === 'image' ? value : 'all'
}

export function matchesHistoryContentType(item: { type: string; content: string | null }, type: HistoryContentType): boolean {
  if (type === 'all') return true
  if (type === 'image') return item.type === 'image'
  if (item.type !== 'text') return false
  const isUrl = Boolean(item.content && normalizeHttpUrl(item.content))
  return type === 'url' ? isUrl : !isUrl
}

/** Each whitespace-separated word must match content, folder, or tags. */
export function buildHistorySearch(search: string): { clause: string; params: string[] } {
  const terms = search.slice(0, 500).trim().split(/\s+/u).filter(Boolean)
  return {
    clause: terms.map(() => " AND (content LIKE ? ESCAPE '\\' OR favorite_folder LIKE ? ESCAPE '\\' OR favorite_tags LIKE ? ESCAPE '\\')").join(''),
    params: terms.flatMap((term) => {
      const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`
      return [pattern, pattern, pattern]
    }),
  }
}
