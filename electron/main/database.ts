import path from 'path'
import { app } from 'electron'
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js'
import fs from 'fs'
import { createHash, randomUUID } from 'crypto'
import type { BackupSnapshot, BackupHistoryItem, BackupStickerItem } from './backup'
import { getHistoryImagesDir, getStickersDir, isPathInside } from './asset-paths'

let db: SqlJsDatabase
const DB_PATH = path.join(app.getPath('userData'), 'clipboard.db')
const DB_BACKUP_PATH = `${DB_PATH}.bak`
const DB_TEMP_PATH = `${DB_PATH}.tmp`
let saveTimer: NodeJS.Timeout | null = null
let savePending = false

function writeFileDurably(filePath: string, data: Buffer): void {
  const fd = fs.openSync(filePath, 'w')
  try {
    fs.writeFileSync(fd, data)
    fs.fsyncSync(fd)
  } finally {
    fs.closeSync(fd)
  }
}

/** Keep the previous complete database until the new export is safely in place. */
function writeDatabaseAtomically(data: Uint8Array): void {
  const buffer = Buffer.from(data)
  writeFileDurably(DB_TEMP_PATH, buffer)

  if (fs.existsSync(DB_BACKUP_PATH)) fs.unlinkSync(DB_BACKUP_PATH)
  if (fs.existsSync(DB_PATH)) fs.renameSync(DB_PATH, DB_BACKUP_PATH)

  try {
    fs.renameSync(DB_TEMP_PATH, DB_PATH)
  } catch (error) {
    if (!fs.existsSync(DB_PATH) && fs.existsSync(DB_BACKUP_PATH)) {
      fs.renameSync(DB_BACKUP_PATH, DB_PATH)
    }
    throw error
  }
}

function flushDatabase(): void {
  if (!db || !savePending) return
  try {
    writeDatabaseAtomically(db.export())
    savePending = false
  } catch (error) {
    console.error('Failed to save clipboard database:', error)
  }
}

/** Debounced save — batches rapid writes into a single disk flush */
function saveDb() {
  if (!db) return
  savePending = true
  if (saveTimer) return // already scheduled
  saveTimer = setTimeout(() => {
    saveTimer = null
    flushDatabase()
    if (savePending) saveDb()
  }, 500)
}

/** Immediate save for shutdown — flushes any pending debounce */
function saveDbSync() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  flushDatabase()
}

function isDatabaseHealthy(database: SqlJsDatabase): boolean {
  try {
    const result = database.exec('PRAGMA quick_check')
    return String(result[0]?.values[0]?.[0] || '').toLowerCase() === 'ok'
  } catch {
    return false
  }
}

function openDatabaseFile(SQL: any, filePath: string): SqlJsDatabase | null {
  if (!fs.existsSync(filePath)) return null
  try {
    const candidate = new SQL.Database(new Uint8Array(fs.readFileSync(filePath))) as SqlJsDatabase
    if (isDatabaseHealthy(candidate)) return candidate
    candidate.close()
  } catch (error) {
    console.error(`Failed to open database file ${filePath}:`, error)
  }
  return null
}

function recoverDatabase(SQL: any): SqlJsDatabase {
  const primary = openDatabaseFile(SQL, DB_PATH)
  if (primary) {
    try { if (fs.existsSync(DB_TEMP_PATH)) fs.unlinkSync(DB_TEMP_PATH) } catch { /* ignore stale temp */ }
    return primary
  }

  const backup = openDatabaseFile(SQL, DB_BACKUP_PATH)
  if (backup) {
    try {
      if (fs.existsSync(DB_PATH)) {
        fs.renameSync(DB_PATH, `${DB_PATH}.corrupt-${Date.now()}`)
      }
      fs.copyFileSync(DB_BACKUP_PATH, DB_PATH)
      console.warn('Recovered clipboard database from the last known-good snapshot.')
    } catch (error) {
      console.error('Failed to restore clipboard database snapshot:', error)
    }
    return backup
  }

  return new SQL.Database()
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
    SQL = await initSqlJs({ wasmBinary: Uint8Array.from(wasmBinary).buffer })
  } else {
    SQL = await initSqlJs()
  }

  db = recoverDatabase(SQL)

  db.run(`
    CREATE TABLE IF NOT EXISTS clipboard_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT,
      image_path TEXT,
      is_pinned INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      use_count INTEGER NOT NULL DEFAULT 1,
      last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      content_hash TEXT NOT NULL DEFAULT '',
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
  if (!historyColumns.has('use_count')) db.run('ALTER TABLE clipboard_history ADD COLUMN use_count INTEGER NOT NULL DEFAULT 1')
  if (!historyColumns.has('last_used_at')) {
    db.run("ALTER TABLE clipboard_history ADD COLUMN last_used_at TEXT NOT NULL DEFAULT ''")
    db.run("UPDATE clipboard_history SET last_used_at = created_at WHERE last_used_at = ''")
  }
  if (!historyColumns.has('content_hash')) db.run("ALTER TABLE clipboard_history ADD COLUMN content_hash TEXT NOT NULL DEFAULT ''")
  db.run("UPDATE clipboard_history SET last_used_at = created_at WHERE last_used_at IS NULL OR last_used_at = ''")
  db.run('CREATE INDEX IF NOT EXISTS idx_history_recent ON clipboard_history(is_pinned, last_used_at DESC)')
  db.run('CREATE INDEX IF NOT EXISTS idx_history_hash ON clipboard_history(type, content_hash)')

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

  if (!getSetting('retention_days')) setSetting('retention_days', '3')
  if (!getSetting('hotkey')) setSetting('hotkey', 'Ctrl+Shift+V')
  if (!getSetting('dark_mode')) setSetting('dark_mode', 'false')
  if (!getSetting('max_history_items')) setSetting('max_history_items', '500')
  if (!getSetting('max_image_size_mb')) setSetting('max_image_size_mb', '10')
  if (!getSetting('monitor_paused')) setSetting('monitor_paused', 'false')

  cleanupStorageIntegrity()
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
  use_count: number
  last_used_at: string
  content_hash: string
}

export interface HistoryInsertResult {
  created: boolean
  id: number | null
}

export function insertHistory(
  type: 'text' | 'image',
  content: string | null,
  imagePath: string | null,
  contentHash: string = ''
): HistoryInsertResult {
  if (!db) return { created: false, id: null }

  const duplicateQuery = type === 'text'
    ? 'SELECT id FROM clipboard_history WHERE type = ? AND content = ? ORDER BY last_used_at DESC, id DESC LIMIT 1'
    : 'SELECT id FROM clipboard_history WHERE type = ? AND content_hash = ? AND content_hash <> \'\' ORDER BY last_used_at DESC, id DESC LIMIT 1'
  const duplicateParams = type === 'text' ? [type, content] : [type, contentHash]
  const duplicateStmt = db.prepare(duplicateQuery)
  duplicateStmt.bind(duplicateParams)
  if (duplicateStmt.step()) {
    const duplicateId = Number(duplicateStmt.getAsObject().id)
    duplicateStmt.free()
    db.run('UPDATE clipboard_history SET use_count = use_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [duplicateId])
    saveDb()
    return { created: false, id: duplicateId }
  }
  duplicateStmt.free()

  db.run(
    'INSERT INTO clipboard_history (type, content, image_path, content_hash) VALUES (?, ?, ?, ?)',
    [type, content, imagePath, contentHash]
  )
  enforceHistoryLimit(parseInt(getSetting('max_history_items') || '500', 10))
  saveDb()
  return { created: true, id: Number(db.exec('SELECT last_insert_rowid() AS id')[0]?.values[0]?.[0] || 0) || null }
}

export function recordHistoryUse(id: number): boolean {
  if (!db || !Number.isInteger(id) || id < 1) return false
  db.run('UPDATE clipboard_history SET use_count = use_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [id])
  const updated = db.getRowsModified() > 0
  if (updated) saveDb()
  return updated
}

function removeHistoryRows(ids: number[]): number {
  if (ids.length === 0) return 0
  const placeholders = ids.map(() => '?').join(',')
  const stmt = db.prepare(`SELECT image_path FROM clipboard_history WHERE id IN (${placeholders})`)
  stmt.bind(ids)
  while (stmt.step()) {
    const imagePath = stmt.getAsObject().image_path as string | null
    if (imagePath && isPathInside(getHistoryImagesDir(), imagePath) && fs.existsSync(imagePath)) {
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
  const stmt = db.prepare("SELECT id FROM clipboard_history WHERE is_pinned = 0 AND is_favorite = 0 ORDER BY COALESCE(NULLIF(last_used_at, ''), created_at) ASC, id ASC LIMIT ?")
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

export function getHistoryList(
  search: string = '',
  filter: 'all' | 'favorites' = 'all',
  folder: string = '',
  sort: 'recent' | 'frequent' = 'recent'
): HistoryItem[] {
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

    if (filter === 'favorites') {
      query += ' ORDER BY is_pinned DESC, favorite_sort_order ASC, created_at DESC'
    } else if (sort === 'frequent') {
      query += ' ORDER BY is_pinned DESC, use_count DESC, last_used_at DESC, created_at DESC'
    } else {
      query += " ORDER BY is_pinned DESC, COALESCE(NULLIF(last_used_at, ''), created_at) DESC, id DESC"
    }

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

export function getHistoryById(id: number): HistoryItem | null {
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
  if (removeHistoryRows([id]) > 0) saveDb()
}

export function clearAllHistory(): void {
  if (!db) return
  try {
    const stmt = db.prepare("SELECT image_path FROM clipboard_history WHERE type = 'image' AND image_path IS NOT NULL")
    while (stmt.step()) {
      const row = stmt.getAsObject()
      const imgPath = row.image_path as string
      if (imgPath && isPathInside(getHistoryImagesDir(), imgPath) && fs.existsSync(imgPath)) {
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
    const removed = removeHistoryRows(ids)
    if (removed > 0) saveDb()
    return removed
  } catch {
    return 0
  }
}

export function deleteExpiredHistory(retentionDays: number): number {
  if (!db || retentionDays <= 0) return 0
  try {
    const stmt = db.prepare(
      "SELECT id FROM clipboard_history WHERE is_pinned = 0 AND is_favorite = 0 AND datetime(COALESCE(NULLIF(last_used_at, ''), created_at), '+' || ? || ' days') < datetime('now')"
    )
    stmt.bind([retentionDays])
    const ids: number[] = []
    while (stmt.step()) ids.push(Number(stmt.getAsObject().id))
    stmt.free()
    const removed = removeHistoryRows(ids)
    if (removed > 0) saveDb()
    return removed
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

export function getStickerById(id: number): StickerItem | null {
  if (!db || !Number.isInteger(id) || id < 1) return null
  const stmt = db.prepare('SELECT * FROM stickers WHERE id = ?')
  stmt.bind([id])
  const item = stmt.step() ? stmt.getAsObject() as unknown as StickerItem : null
  stmt.free()
  return item
}

export function deleteSticker(id: number): void {
  if (!db) return
  try {
    const stmt = db.prepare('SELECT image_path FROM stickers WHERE id = ?')
    stmt.bind([id])
    if (stmt.step()) {
      const row = stmt.getAsObject()
      const imgPath = row.image_path as string
      if (imgPath && isPathInside(getStickersDir(), imgPath) && fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath)
      }
    }
    stmt.free()
  } catch { /* ignore */ }

  db.run('DELETE FROM stickers WHERE id = ?', [id])
  saveDb()
}

const PORTABLE_SETTING_KEYS = ['retention_days', 'dark_mode', 'max_history_items', 'max_image_size_mb', 'monitor_paused'] as const

export function getBackupSnapshot(): BackupSnapshot {
  const historyStmt = db.prepare('SELECT * FROM clipboard_history ORDER BY id ASC')
  const history: BackupHistoryItem[] = []
  while (historyStmt.step()) history.push(historyStmt.getAsObject() as unknown as BackupHistoryItem)
  historyStmt.free()

  const settings: Record<string, string> = {}
  for (const key of PORTABLE_SETTING_KEYS) {
    const value = getSetting(key)
    if (value !== null) settings[key] = value
  }

  return { history, stickers: getStickerList(), settings }
}

export interface BackupImportResult {
  historyCount: number
  stickerCount: number
  skippedDuplicates: number
}

function fileHash(filePath: string): string {
  try {
    return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
  } catch {
    return ''
  }
}

function removeFiles(filePaths: Iterable<string>): void {
  for (const filePath of filePaths) {
    try {
      const managed = filePath && (
        isPathInside(getHistoryImagesDir(), filePath) || isPathInside(getStickersDir(), filePath)
      )
      if (managed && fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (error) {
      console.error('Failed to remove imported or replaced asset:', error)
    }
  }
}

function validatedPortableSetting(key: string, value: string): string | null {
  if (key === 'dark_mode') return value === 'true' ? 'true' : value === 'false' ? 'false' : null
  if (key === 'retention_days') return ['0', '1', '3', '5'].includes(value) ? value : null
  if (key === 'max_history_items') return ['100', '300', '500', '1000'].includes(value) ? value : null
  if (key === 'max_image_size_mb') return ['1', '5', '10', '20'].includes(value) ? value : null
  if (key === 'monitor_paused') return value === 'true' ? 'true' : value === 'false' ? 'false' : null
  return null
}

export function importBackupSnapshot(snapshot: BackupSnapshot, mode: 'merge' | 'replace'): BackupImportResult {
  if (!db) throw new Error('Database is not initialized.')

  const oldFiles = new Set<string>()
  if (mode === 'replace') {
    for (const item of getBackupSnapshot().history) if (item.image_path) oldFiles.add(item.image_path)
    for (const sticker of getStickerList()) oldFiles.add(sticker.image_path)
  }

  const existingStickerHashes = new Set(
    mode === 'merge' ? getStickerList().map((item) => fileHash(item.image_path)).filter(Boolean) : []
  )
  const unusedImportedFiles = new Set<string>()
  let historyCount = 0
  let stickerCount = 0
  let skippedDuplicates = 0

  db.run('BEGIN TRANSACTION')
  try {
    if (mode === 'replace') {
      db.run('DELETE FROM clipboard_history')
      db.run('DELETE FROM stickers')
    }

    for (const item of snapshot.history) {
      const duplicateQuery = item.type === 'text'
        ? 'SELECT id FROM clipboard_history WHERE type = ? AND content = ? LIMIT 1'
        : "SELECT id FROM clipboard_history WHERE type = ? AND content_hash = ? AND content_hash <> '' LIMIT 1"
      const duplicateStmt = db.prepare(duplicateQuery)
      duplicateStmt.bind(item.type === 'text' ? [item.type, item.content] : [item.type, item.content_hash])
      const duplicateId = duplicateStmt.step() ? Number(duplicateStmt.getAsObject().id) : 0
      duplicateStmt.free()

      if (duplicateId) {
        db.run(`
          UPDATE clipboard_history SET
            is_pinned = MAX(is_pinned, ?),
            is_favorite = MAX(is_favorite, ?),
            favorite_folder = CASE WHEN favorite_folder = '' THEN ? ELSE favorite_folder END,
            favorite_tags = CASE WHEN favorite_tags = '' THEN ? ELSE favorite_tags END,
            use_count = MAX(use_count, ?),
            last_used_at = CASE WHEN datetime(?) > datetime(last_used_at) THEN ? ELSE last_used_at END,
            created_at = CASE WHEN datetime(?) < datetime(created_at) THEN ? ELSE created_at END
          WHERE id = ?
        `, [
          item.is_pinned, item.is_favorite, item.favorite_folder, item.favorite_tags, item.use_count,
          item.last_used_at, item.last_used_at, item.created_at, item.created_at, duplicateId,
        ])
        if (item.image_path) unusedImportedFiles.add(item.image_path)
        skippedDuplicates++
        continue
      }

      db.run(`
        INSERT INTO clipboard_history (
          type, content, image_path, is_pinned, is_favorite, created_at,
          favorite_folder, favorite_tags, favorite_sort_order, use_count, last_used_at, content_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        item.type, item.content, item.image_path, item.is_pinned, item.is_favorite, item.created_at,
        item.favorite_folder, item.favorite_tags, item.favorite_sort_order, item.use_count, item.last_used_at, item.content_hash,
      ])
      historyCount++
    }

    for (const sticker of snapshot.stickers) {
      const hash = fileHash(sticker.image_path)
      if (!hash || existingStickerHashes.has(hash)) {
        unusedImportedFiles.add(sticker.image_path)
        skippedDuplicates++
        continue
      }
      db.run('INSERT INTO stickers (name, image_path, created_at) VALUES (?, ?, ?)', [sticker.name, sticker.image_path, sticker.created_at])
      existingStickerHashes.add(hash)
      stickerCount++
    }

    for (const [key, rawValue] of Object.entries(snapshot.settings)) {
      const value = validatedPortableSetting(key, rawValue)
      if (value !== null) db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value])
    }

    db.run('COMMIT')
  } catch (error) {
    try { db.run('ROLLBACK') } catch { /* ignore rollback failure */ }
    throw error
  }

  removeFiles(unusedImportedFiles)
  if (mode === 'replace') removeFiles(oldFiles)
  enforceHistoryLimit(parseInt(getSetting('max_history_items') || '500', 10))
  saveDb()
  return { historyCount, stickerCount, skippedDuplicates }
}

export interface StorageCleanupResult {
  missingHistoryRows: number
  missingStickerRows: number
  orphanFiles: number
}

function relocateAssetToManagedDirectory(filePath: string, directory: string, prefix: string): string {
  if (isPathInside(directory, filePath)) return filePath
  const rawExtension = path.extname(filePath).toLowerCase()
  const extension = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(rawExtension) ? rawExtension : '.png'
  const destination = path.join(directory, `${prefix}_${Date.now()}_${randomUUID()}${extension}`)
  fs.copyFileSync(filePath, destination)
  return destination
}

export function cleanupStorageIntegrity(): StorageCleanupResult {
  if (!db) return { missingHistoryRows: 0, missingStickerRows: 0, orphanFiles: 0 }

  const referencedFiles = new Set<string>()
  const missingHistoryIds: number[] = []
  const historyStmt = db.prepare("SELECT id, image_path FROM clipboard_history WHERE type = 'image'")
  while (historyStmt.step()) {
    const row = historyStmt.getAsObject()
    let imagePath = typeof row.image_path === 'string' ? row.image_path : ''
    if (!imagePath || !fs.existsSync(imagePath)) missingHistoryIds.push(Number(row.id))
    else {
      try {
        const relocatedPath = relocateAssetToManagedDirectory(imagePath, getHistoryImagesDir(), 'migrated_clip')
        if (relocatedPath !== imagePath) {
          db.run('UPDATE clipboard_history SET image_path = ? WHERE id = ?', [relocatedPath, Number(row.id)])
          imagePath = relocatedPath
        }
        referencedFiles.add(path.resolve(imagePath).toLowerCase())
      } catch (error) {
        console.error('Failed to relocate legacy history image:', error)
        missingHistoryIds.push(Number(row.id))
      }
    }
  }
  historyStmt.free()
  const missingHistoryRows = removeHistoryRows(missingHistoryIds)

  const missingStickerIds: number[] = []
  const stickerStmt = db.prepare('SELECT id, image_path FROM stickers')
  while (stickerStmt.step()) {
    const row = stickerStmt.getAsObject()
    let imagePath = typeof row.image_path === 'string' ? row.image_path : ''
    if (!imagePath || !fs.existsSync(imagePath)) missingStickerIds.push(Number(row.id))
    else {
      try {
        const relocatedPath = relocateAssetToManagedDirectory(imagePath, getStickersDir(), 'migrated_sticker')
        if (relocatedPath !== imagePath) {
          db.run('UPDATE stickers SET image_path = ? WHERE id = ?', [relocatedPath, Number(row.id)])
          imagePath = relocatedPath
        }
        referencedFiles.add(path.resolve(imagePath).toLowerCase())
      } catch (error) {
        console.error('Failed to relocate legacy sticker image:', error)
        missingStickerIds.push(Number(row.id))
      }
    }
  }
  stickerStmt.free()
  if (missingStickerIds.length > 0) {
    const placeholders = missingStickerIds.map(() => '?').join(',')
    db.run(`DELETE FROM stickers WHERE id IN (${placeholders})`, missingStickerIds)
  }
  const missingStickerRows = missingStickerIds.length

  let orphanFiles = 0
  for (const directory of [getHistoryImagesDir(), getStickersDir()]) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const filePath = path.join(directory, entry.name)
      if (!referencedFiles.has(path.resolve(filePath).toLowerCase()) && isPathInside(directory, filePath)) {
        try {
          fs.unlinkSync(filePath)
          orphanFiles++
        } catch (error) {
          console.error('Failed to remove orphaned asset:', error)
        }
      }
    }
  }

  if (missingHistoryRows > 0 || missingStickerRows > 0 || orphanFiles > 0) saveDb()
  return { missingHistoryRows, missingStickerRows, orphanFiles }
}

export function closeDatabase(): void {
  if (db) {
    saveDbSync()
    db.close()
  }
}
