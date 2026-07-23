import path from 'path'
import { app } from 'electron'
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import fs from 'fs'

let db: SqlJsDatabase
const DB_PATH = path.join(app.getPath('userData'), 'clipboard.db')
let saveTimer: NodeJS.Timeout | null = null
let savePending = false

/** Debounced save — batches rapid writes into a single disk flush */
function saveDb() {
  if (!db) return
  savePending = true
  if (saveTimer) return // already scheduled
  saveTimer = setTimeout(() => {
    saveTimer = null
    savePending = false
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(DB_PATH, buffer)
  }, 500)
}

/** Immediate save for shutdown — flushes any pending debounce */
function saveDbSync() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!db || !savePending) return
  savePending = false
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

  const historyColumns = new Set<string>()
  const columnStmt = db.prepare('PRAGMA table_info(clipboard_history)')
  while (columnStmt.step()) historyColumns.add(String(columnStmt.getAsObject().name))
  columnStmt.free()
  if (!historyColumns.has('favorite_folder')) db.run("ALTER TABLE clipboard_history ADD COLUMN favorite_folder TEXT NOT NULL DEFAULT ''")
  if (!historyColumns.has('favorite_tags')) db.run("ALTER TABLE clipboard_history ADD COLUMN favorite_tags TEXT NOT NULL DEFAULT ''")
  if (!historyColumns.has('favorite_sort_order')) {
    db.run('ALTER TABLE clipboard_history ADD COLUMN favorite_sort_order INTEGER NOT NULL DEFAULT 0')
    db.run('UPDATE clipboard_history SET favorite_sort_order = -id WHERE is_favorite = 1')
  }

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
    setSetting('dark_mode', 'false')
  }
  if (!getSetting('max_history_items')) setSetting('max_history_items', '500')
  if (!getSetting('max_image_size_mb')) setSetting('max_image_size_mb', '10')

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
  favorite_folder: string
  favorite_tags: string
  favorite_sort_order: number
}

export function insertHistory(type: 'text' | 'image', content: string | null, imagePath: string | null): boolean {
  if (!db) return false
  db.run(
    'INSERT INTO clipboard_history (type, content, image_path) VALUES (?, ?, ?)',
    [type, content, imagePath]
  )
  enforceHistoryLimit(parseInt(getSetting('max_history_items') || '500', 10))
  saveDb()
  return true
}

function removeHistoryRows(ids: number[]): number {
  if (ids.length === 0) return 0
  const placeholders = ids.map(() => '?').join(',')
  const stmt = db.prepare(`SELECT image_path FROM clipboard_history WHERE id IN (${placeholders})`)
  stmt.bind(ids)
  while (stmt.step()) {
    const imagePath = stmt.getAsObject().image_path as string | null
    if (imagePath && fs.existsSync(imagePath)) {
      try { fs.unlinkSync(imagePath) } catch (error) { console.error('Failed to remove history image:', error) }
    }
  }
  stmt.free()
  db.run(`DELETE FROM clipboard_history WHERE id IN (${placeholders})`, ids)
  return db.getRowsModified()
}

export function enforceHistoryLimit(limit: number): number {
  if (!db || !Number.isFinite(limit) || limit < 1) return 0
  const total = Number(db.exec('SELECT COUNT(*) AS count FROM clipboard_history')[0]?.values[0]?.[0] || 0)
  const overflow = total - limit
  if (overflow <= 0) return 0
  const stmt = db.prepare('SELECT id FROM clipboard_history WHERE is_pinned = 0 AND is_favorite = 0 ORDER BY created_at ASC, id ASC LIMIT ?')
  stmt.bind([overflow])
  const ids: number[] = []
  while (stmt.step()) ids.push(Number(stmt.getAsObject().id))
  stmt.free()
  const removed = removeHistoryRows(ids)
  if (removed > 0) saveDb()
  return removed
}

export interface HistoryStats {
  itemCount: number
  imageBytes: number
}

export function getHistoryStats(): HistoryStats {
  const itemCount = Number(db.exec('SELECT COUNT(*) AS count FROM clipboard_history')[0]?.values[0]?.[0] || 0)
  const stmt = db.prepare("SELECT image_path FROM clipboard_history WHERE image_path IS NOT NULL")
  let imageBytes = 0
  while (stmt.step()) {
    const imagePath = stmt.getAsObject().image_path as string
    try { if (imagePath && fs.existsSync(imagePath)) imageBytes += fs.statSync(imagePath).size } catch { /* skip unreadable file */ }
  }
  stmt.free()
  return { itemCount, imageBytes }
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

export function getHistoryList(search: string = '', filter: 'all' | 'favorites' = 'all', folder: string = ''): HistoryItem[] {
  if (!db) return []
  try {
    let query = 'SELECT * FROM clipboard_history WHERE 1=1'
    const params: any[] = []

    if (filter === 'favorites') {
      query += ' AND is_favorite = 1'
      if (folder) {
        query += ' AND favorite_folder = ?'
        params.push(folder)
      }
    }

    if (search) {
      query += ' AND type = ? AND content LIKE ?'
      params.push('text', `%${search}%`)
    }

    query += filter === 'favorites'
      ? ' ORDER BY is_pinned DESC, favorite_sort_order ASC, created_at DESC'
      : ' ORDER BY is_pinned DESC, created_at DESC'

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
  const item = getHistoryById(id)
  if (!item) return
  if (item.is_favorite) {
    db.run('UPDATE clipboard_history SET is_favorite = 0 WHERE id = ?', [id])
  } else {
    const minStmt = db.prepare('SELECT MIN(favorite_sort_order) AS min_order FROM clipboard_history WHERE is_favorite = 1')
    minStmt.step()
    const minOrder = Number(minStmt.getAsObject().min_order || 0)
    minStmt.free()
    db.run('UPDATE clipboard_history SET is_favorite = 1, favorite_sort_order = ? WHERE id = ?', [minOrder - 1, id])
  }
  saveDb()
}

function getHistoryById(id: number): HistoryItem | null {
  const stmt = db.prepare('SELECT * FROM clipboard_history WHERE id = ?')
  stmt.bind([id])
  const item = stmt.step() ? stmt.getAsObject() as unknown as HistoryItem : null
  stmt.free()
  return item
}

export function getFavoriteFolders(): string[] {
  const stmt = db.prepare("SELECT DISTINCT favorite_folder FROM clipboard_history WHERE is_favorite = 1 AND favorite_folder <> '' ORDER BY favorite_folder COLLATE NOCASE")
  const folders: string[] = []
  while (stmt.step()) folders.push(String(stmt.getAsObject().favorite_folder))
  stmt.free()
  return folders
}

export function updateFavoriteMetadata(id: number, folder: string, tags: string): void {
  db.run('UPDATE clipboard_history SET favorite_folder = ?, favorite_tags = ? WHERE id = ? AND is_favorite = 1', [folder.trim(), tags.trim(), id])
  saveDb()
}

export function moveFavorite(id: number, direction: 'up' | 'down'): boolean {
  const item = getHistoryById(id)
  if (!item || !item.is_favorite) return false
  const favorites = getHistoryList('', 'favorites').filter((favorite) => favorite.is_pinned === item.is_pinned)
  const index = favorites.findIndex((item) => item.id === id)
  const nextIndex = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || nextIndex < 0 || nextIndex >= favorites.length) return false

  const current = favorites[index]
  const adjacent = favorites[nextIndex]
  db.run('UPDATE clipboard_history SET favorite_sort_order = ? WHERE id = ?', [adjacent.favorite_sort_order, current.id])
  db.run('UPDATE clipboard_history SET favorite_sort_order = ? WHERE id = ?', [current.favorite_sort_order, adjacent.id])
  saveDb()
  return true
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

export function batchDeleteHistory(ids: number[]): number {
  if (!db || ids.length === 0) return 0
  try {
    const placeholders = ids.map(() => '?').join(',')
    // Delete associated image files
    const stmt = db.prepare(`SELECT image_path FROM clipboard_history WHERE id IN (${placeholders})`)
    stmt.bind(ids)
    while (stmt.step()) {
      const row = stmt.getAsObject()
      const imgPath = row.image_path as string | null
      if (imgPath && fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath)
      }
    }
    stmt.free()

    // Delete records
    db.run(`DELETE FROM clipboard_history WHERE id IN (${placeholders})`, ids)
    const changes = db.getRowsModified()
    saveDb()
    return changes
  } catch {
    return 0
  }
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
    saveDbSync()
    db.close()
  }
}
