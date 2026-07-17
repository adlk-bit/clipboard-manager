import path from 'path'
import { app } from 'electron'
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import fs from 'fs'

let db: SqlJsDatabase
const DB_PATH = path.join(app.getPath('userData'), 'clipboard.db')

function saveDb() {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(DB_PATH, buffer)
}

export async function initDatabaseAsync(): Promise<SqlJsDatabase> {
  const wasmPath = path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
  let wasmBinary: Uint8Array | null = null

  try {
    wasmBinary = fs.readFileSync(wasmPath)
  } catch {
    const prodWasm = path.join(process.resourcesPath!, 'sql-wasm.wasm')
    if (fs.existsSync(prodWasm)) {
      wasmBinary = fs.readFileSync(prodWasm)
    }
  }

  let SQL: any
  if (wasmBinary) {
    SQL = await initSqlJs({ wasmBinary })
  } else {
    SQL = await initSqlJs()
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(new Uint8Array(fileBuffer))
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS clipboard_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT,
      image_path TEXT,
      is_pinned INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS stickers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      image_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)

  const existingRetention = getSetting('retention_days')
  if (!existingRetention) {
    setSetting('retention_days', '3')
    setSetting('hotkey', 'Ctrl+Shift+V')
    setSetting('auto_hide', 'true')
  }

  saveDb()
  return db
}

export function getSetting(key: string): string | null {
  if (!db) return null
  try {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?')
    stmt.bind([key])
    if (stmt.step()) {
      const row = stmt.getAsObject()
      stmt.free()
      return row.value as string
    }
    stmt.free()
  } catch { /* ignore */ }
  return null
}

export function setSetting(key: string, value: string): void {
  if (!db) return
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
  saveDb()
}

export interface HistoryItem {
  id: number
  type: 'text' | 'image'
  content: string | null
  image_path: string | null
  is_pinned: number
  is_favorite: number
  created_at: string
}

export function insertHistory(type: 'text' | 'image', content: string | null, imagePath: string | null): void {
  if (!db) return
  db.run(
    'INSERT INTO clipboard_history (type, content, image_path) VALUES (?, ?, ?)',
    [type, content, imagePath]
  )
  saveDb()
}

export function getLastHistory(): HistoryItem | null {
  if (!db) return null
  try {
    const stmt = db.prepare('SELECT * FROM clipboard_history ORDER BY id DESC LIMIT 1')
    if (stmt.step()) {
      const row = stmt.getAsObject()
      stmt.free()
      return row as unknown as HistoryItem
    }
    stmt.free()
  } catch { /* ignore */ }
  return null
}

export function getHistoryList(search: string = '', filter: 'all' | 'favorites' = 'all'): HistoryItem[] {
  if (!db) return []
  try {
    let query = 'SELECT * FROM clipboard_history WHERE 1=1'
    const params: any[] = []

    if (filter === 'favorites') {
      query += ' AND is_favorite = 1'
    }

    if (search) {
      query += ' AND type = ? AND content LIKE ?'
      params.push('text', `%${search}%`)
    }

    query += ' ORDER BY is_pinned DESC, created_at DESC'

    const stmt = db.prepare(query)
    if (params.length > 0) {
      stmt.bind(params)
    }

    const results: HistoryItem[] = []
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as HistoryItem)
    }
    stmt.free()
    return results
  } catch {
    return []
  }
}

export function togglePin(id: number): void {
  if (!db) return
  db.run('UPDATE clipboard_history SET is_pinned = CASE WHEN is_pinned = 0 THEN 1 ELSE 0 END WHERE id = ?', [id])
  saveDb()
}

export function toggleFavorite(id: number): void {
  if (!db) return
  db.run('UPDATE clipboard_history SET is_favorite = CASE WHEN is_favorite = 0 THEN 1 ELSE 0 END WHERE id = ?', [id])
  saveDb()
}

export function deleteHistory(id: number): void {
  if (!db) return
  try {
    const stmt = db.prepare('SELECT image_path FROM clipboard_history WHERE id = ?')
    stmt.bind([id])
    if (stmt.step()) {
      const row = stmt.getAsObject()
      const imgPath = row.image_path as string | null
      if (imgPath && fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath)
      }
    }
    stmt.free()
  } catch { /* ignore */ }

  db.run('DELETE FROM clipboard_history WHERE id = ?', [id])
  saveDb()
}

export function clearAllHistory(): void {
  if (!db) return
  try {
    const stmt = db.prepare("SELECT image_path FROM clipboard_history WHERE type = 'image' AND image_path IS NOT NULL")
    while (stmt.step()) {
      const row = stmt.getAsObject()
      const imgPath = row.image_path as string
      if (imgPath && fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath)
      }
    }
    stmt.free()
  } catch { /* ignore */ }

  db.run('DELETE FROM clipboard_history')
  saveDb()
}

export function deleteExpiredHistory(retentionDays: number): number {
  if (!db || retentionDays <= 0) return 0
  try {
    db.run(
      "DELETE FROM clipboard_history WHERE is_pinned = 0 AND is_favorite = 0 AND datetime(created_at, '+' || ? || ' days') < datetime('now', 'localtime')",
      [retentionDays]
    )
    const changes = db.getRowsModified()
    saveDb()
    return changes
  } catch {
    return 0
  }
}

export interface StickerItem {
  id: number
  name: string | null
  image_path: string
  created_at: string
}

export function insertSticker(name: string, imagePath: string): void {
  if (!db) return
  db.run('INSERT INTO stickers (name, image_path) VALUES (?, ?)', [name, imagePath])
  saveDb()
}

export function getStickerList(): StickerItem[] {
  if (!db) return []
  try {
    const results: StickerItem[] = []
    const stmt = db.prepare('SELECT * FROM stickers ORDER BY created_at DESC')
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as StickerItem)
    }
    stmt.free()
    return results
  } catch {
    return []
  }
}

export function deleteSticker(id: number): void {
  if (!db) return
  try {
    const stmt = db.prepare('SELECT image_path FROM stickers WHERE id = ?')
    stmt.bind([id])
    if (stmt.step()) {
      const row = stmt.getAsObject()
      const imgPath = row.image_path as string
      if (imgPath && fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath)
      }
    }
    stmt.free()
  } catch { /* ignore */ }

  db.run('DELETE FROM stickers WHERE id = ?', [id])
  saveDb()
}

export function exportHistory(): string {
  const results = getHistoryList()
  return JSON.stringify(results, null, 2)
}

export function importHistory(jsonStr: string): number {
  if (!db) return 0
  try {
    const items: HistoryItem[] = JSON.parse(jsonStr)
    let count = 0
    const stmt = db.prepare(
      'INSERT INTO clipboard_history (type, content, image_path, is_pinned, is_favorite, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )

    for (const item of items) {
      stmt.run([item.type, item.content, item.image_path, item.is_pinned, item.is_favorite, item.created_at])
      count++
    }
    stmt.free()
    saveDb()
    return count
  } catch {
    return 0
  }
}

export function closeDatabase(): void {
  if (db) {
    saveDb()
    db.close()
  }
}
