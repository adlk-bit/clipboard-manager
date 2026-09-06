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
export function buildHistorySearch(search: string, includeProductivity = false): { clause: string; params: string[] } {
  const terms = search.slice(0, 500).trim().split(/\s+/u).filter(Boolean)
  const fields = ['content', 'favorite_folder', 'favorite_tags', ...(includeProductivity ? ['ocr_text', 'source_app'] : [])]
  return {
    clause: terms.map(() => ` AND (${fields.map((field) => `${field} LIKE ? ESCAPE '\\'`).join(' OR ')})`).join(''),
    params: terms.flatMap((term) => {
      const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`
      return fields.map(() => pattern)
    }),
  }
}
