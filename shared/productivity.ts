export interface TextTemplate { id: number; title: string; body: string; created_at: string; updated_at: string }
export interface OcrStatus { languages: { tag: string; name: string }[]; available: boolean }
export interface OcrResult { text: string; language: string; cached: boolean }
export interface QueueStatus { total: number; cursor: number; paused: boolean; busy: boolean; target: string; error: string }
export const QUEUE_HOTKEY = 'Ctrl+Shift+Alt+V'
export function templateVariables(body: string): string[] {
  const variables = [...new Set([...body.matchAll(/\{\{\s*([^{}\r\n]{1,60}?)\s*\}\}/gu)].map((match) => match[1].trim()))]
  if (variables.length > 32) throw new Error('template-variables-limit')
  return variables
}
export function validateTemplate(title: unknown, body: unknown): { title: string; body: string } {
  if (typeof title !== 'string' || !title.trim() || title.length > 120 || typeof body !== 'string' || !body.trim() || body.length > 10000) throw new Error('invalid-template')
  templateVariables(body)
  return { title: title.trim(), body }
}
export function defaultTemplateValues(body: string, date = new Date()): Record<string, string> {
  const pad = (value: number) => String(value).padStart(2, '0')
  return Object.fromEntries(templateVariables(body).map((key) => [key,
    ['date', '日期'].includes(key) ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
      : ['time', '时间'].includes(key) ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : '']))
}
export function renderTemplate(body: string, values: Record<string, string>): string {
  const keys = templateVariables(body)
  if (keys.some((key) => !Object.prototype.hasOwnProperty.call(values, key) || typeof values[key] !== 'string' || !values[key].trim())) throw new Error('template-missing-value')
  const rendered = body.replace(/\{\{\s*([^{}\r\n]{1,60}?)\s*\}\}/gu, (_match, key: string) => values[key.trim()])
  if (!rendered.trim() || rendered.length > 10000) throw new Error('template-output-limit')
  return rendered
}
export function normalizeSourceApp(value: unknown): string {
  if (typeof value !== 'string') return ''
  const name = value.trim().toLowerCase()
  if (!name || name.length > 120 || /[\\/:*?"<>|\u0000-\u001f]/u.test(name) || name === '.' || name === '..') return ''
  const normalized = name.endsWith('.exe') ? name : name + '.exe'
  return normalized.length <= 120 ? normalized : ''
}
export function parseExcludedApps(value: string): string[] {
  const list: unknown = JSON.parse(value)
  if (!Array.isArray(list) || list.length > 50) throw new Error('invalid-exclusions')
  const normalized = list.map(normalizeSourceApp)
  if (normalized.some((name) => !name)) throw new Error('invalid-exclusions')
  return [...new Set(normalized)]
}
