import { createHash, randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'

export const BACKUP_FORMAT = 'clipboard-manager-backup'
export const BACKUP_FORMAT_VERSION = 1

const MAX_BACKUP_BYTES = 1024 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 5000
const SAFE_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'])

export interface BackupHistoryItem {
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

export interface BackupStickerItem {
  name: string | null
  image_path: string
  created_at: string
}

export interface BackupSnapshot {
  history: BackupHistoryItem[]
  stickers: BackupStickerItem[]
  settings: Record<string, string>
}

interface PortableHistoryItem extends Omit<BackupHistoryItem, 'image_path'> {
  image_asset: string | null
  image_checksum: string
}

interface PortableStickerItem extends Omit<BackupStickerItem, 'image_path'> {
  image_asset: string
  image_checksum: string
}

interface BackupManifest {
  format: typeof BACKUP_FORMAT
  format_version: typeof BACKUP_FORMAT_VERSION
  app_version: string
  exported_at: string
  history: PortableHistoryItem[]
  stickers: PortableStickerItem[]
  settings: Record<string, string>
}

export interface BackupExportResult {
  filePath: string
  historyCount: number
  stickerCount: number
  skippedFiles: number
}

export interface PreparedBackup {
  snapshot: BackupSnapshot
  createdFiles: string[]
  skippedItems: number
  source: 'portable' | 'legacy-json'
}

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

function readImageFile(filePath: string | null): Buffer | null {
  if (!filePath) return null
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return null
    return fs.readFileSync(filePath)
  } catch {
    return null
  }
}

function safeExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return SAFE_IMAGE_EXTENSIONS.has(ext) ? ext : '.png'
}

function uniqueAssetName(prefix: string, checksum: string, extension: string): string {
  return `${prefix}_${Date.now()}_${randomUUID()}_${checksum.slice(0, 12)}${extension}`
}

function writePreparedAsset(directory: string, prefix: string, extension: string, data: Uint8Array): string {
  fs.mkdirSync(directory, { recursive: true })
  const checksum = sha256(data)
  const filePath = path.join(directory, uniqueAssetName(prefix, checksum, extension))
  fs.writeFileSync(filePath, data)
  return filePath
}

export function writePortableBackup(filePath: string, snapshot: BackupSnapshot, appVersion: string): BackupExportResult {
  const entries: Zippable = {}
  const portableHistory: PortableHistoryItem[] = []
  const portableStickers: PortableStickerItem[] = []
  let skippedFiles = 0

  snapshot.history.forEach((item, index) => {
    let imageAsset: string | null = null
    let imageChecksum = ''

    if (item.type === 'image') {
      const image = readImageFile(item.image_path)
      if (!image || !item.image_path) {
        skippedFiles++
        return
      }
      imageChecksum = sha256(image)
      imageAsset = `assets/history/${index}_${imageChecksum.slice(0, 16)}${safeExtension(item.image_path)}`
      entries[imageAsset] = [new Uint8Array(image), { level: 0 }]
    }

    portableHistory.push({
      type: item.type,
      content: item.content,
      image_asset: imageAsset,
      image_checksum: imageChecksum,
      is_pinned: item.is_pinned,
      is_favorite: item.is_favorite,
      created_at: item.created_at,
      favorite_folder: item.favorite_folder,
      favorite_tags: item.favorite_tags,
      favorite_sort_order: item.favorite_sort_order,
      use_count: item.use_count,
      last_used_at: item.last_used_at,
      content_hash: item.content_hash || imageChecksum,
    })
  })

  snapshot.stickers.forEach((item, index) => {
    const image = readImageFile(item.image_path)
    if (!image) {
      skippedFiles++
      return
    }
    const imageChecksum = sha256(image)
    const imageAsset = `assets/stickers/${index}_${imageChecksum.slice(0, 16)}${safeExtension(item.image_path)}`
    entries[imageAsset] = [new Uint8Array(image), { level: 0 }]
    portableStickers.push({
      name: item.name,
      image_asset: imageAsset,
      image_checksum: imageChecksum,
      created_at: item.created_at,
    })
  })

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    format_version: BACKUP_FORMAT_VERSION,
    app_version: appVersion,
    exported_at: new Date().toISOString(),
    history: portableHistory,
    stickers: portableStickers,
    settings: snapshot.settings,
  }
  entries['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))

  const archive = zipSync(entries, { level: 6 })
  const tempPath = `${filePath}.tmp`
  fs.writeFileSync(tempPath, archive)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  fs.renameSync(tempPath, filePath)

  return {
    filePath,
    historyCount: portableHistory.length,
    stickerCount: portableStickers.length,
    skippedFiles,
  }
}

function numberFlag(value: unknown): number {
  return value === 1 || value === true ? 1 : 0
}

function safeText(value: unknown, maxLength: number, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback
}

function safeTimestamp(value: unknown): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value
  return new Date().toISOString()
}

function normalizeHistoryItem(value: unknown): BackupHistoryItem | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (item.type !== 'text' && item.type !== 'image') return null
  const content = item.type === 'text' ? safeText(item.content, 10_001) : null
  if (item.type === 'text' && !(content || '').trim()) return null
  return {
    type: item.type,
    content,
    image_path: typeof item.image_path === 'string' ? item.image_path : null,
    is_pinned: numberFlag(item.is_pinned),
    is_favorite: numberFlag(item.is_favorite),
    created_at: safeTimestamp(item.created_at),
    favorite_folder: safeText(item.favorite_folder, 120),
    favorite_tags: safeText(item.favorite_tags, 500),
    favorite_sort_order: Number.isFinite(Number(item.favorite_sort_order)) ? Number(item.favorite_sort_order) : 0,
    use_count: Math.max(1, Math.min(1_000_000, Number(item.use_count) || 1)),
    last_used_at: safeTimestamp(item.last_used_at || item.created_at),
    content_hash: safeText(item.content_hash, 128),
  }
}

function normalizeStickerItem(value: unknown): BackupStickerItem | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.image_path !== 'string' || !item.image_path) return null
  return {
    name: typeof item.name === 'string' ? item.name.slice(0, 200) : null,
    image_path: item.image_path,
    created_at: safeTimestamp(item.created_at),
  }
}

function isSafeAssetName(name: string): boolean {
  const normalized = name.replace(/\\/g, '/')
  return normalized.startsWith('assets/') && !normalized.includes('../') && !path.posix.isAbsolute(normalized)
}

function parsePortableBackup(buffer: Buffer, imagesDir: string, stickersDir: string): PreparedBackup {
  if (buffer.length > MAX_BACKUP_BYTES) throw new Error('备份文件超过 1 GB，无法安全导入。')
  let entryCount = 0
  let expandedBytes = 0
  const files = unzipSync(new Uint8Array(buffer), {
    filter: (entry) => {
      entryCount++
      expandedBytes += entry.originalSize
      if (entryCount > MAX_ARCHIVE_ENTRIES || expandedBytes > MAX_BACKUP_BYTES) {
        throw new Error('备份展开后超过安全限制。')
      }
      return entry.name === 'manifest.json' || isSafeAssetName(entry.name)
    },
  })
  const manifestData = files['manifest.json']
  if (!manifestData) throw new Error('备份缺少 manifest.json。')

  const parsed = JSON.parse(strFromU8(manifestData)) as Partial<BackupManifest>
  if (parsed.format !== BACKUP_FORMAT || parsed.format_version !== BACKUP_FORMAT_VERSION) {
    throw new Error('不支持的备份格式或版本。')
  }

  const createdFiles: string[] = []
  const history: BackupHistoryItem[] = []
  const stickers: BackupStickerItem[] = []
  let skippedItems = 0

  for (const rawItem of Array.isArray(parsed.history) ? parsed.history : []) {
    const item = normalizeHistoryItem({ ...rawItem, image_path: null })
    if (!item) {
      skippedItems++
      continue
    }
    if (item.type === 'image') {
      const assetName = typeof rawItem.image_asset === 'string' ? rawItem.image_asset : ''
      const data = isSafeAssetName(assetName) ? files[assetName] : undefined
      const expectedHash = safeText(rawItem.image_checksum, 128)
      if (!data || !expectedHash || sha256(data) !== expectedHash) {
        skippedItems++
        continue
      }
      item.image_path = writePreparedAsset(imagesDir, 'imported_clip', safeExtension(assetName), data)
      item.content_hash = item.content_hash || expectedHash
      createdFiles.push(item.image_path)
    }
    history.push(item)
  }

  for (const rawItem of Array.isArray(parsed.stickers) ? parsed.stickers : []) {
    if (!rawItem || typeof rawItem !== 'object') {
      skippedItems++
      continue
    }
    const assetName = typeof rawItem.image_asset === 'string' ? rawItem.image_asset : ''
    const data = isSafeAssetName(assetName) ? files[assetName] : undefined
    const expectedHash = safeText(rawItem.image_checksum, 128)
    if (!data || !expectedHash || sha256(data) !== expectedHash) {
      skippedItems++
      continue
    }
    const filePath = writePreparedAsset(stickersDir, 'imported_sticker', safeExtension(assetName), data)
    createdFiles.push(filePath)
    stickers.push({
      name: typeof rawItem.name === 'string' ? rawItem.name.slice(0, 200) : null,
      image_path: filePath,
      created_at: safeTimestamp(rawItem.created_at),
    })
  }

  const settings: Record<string, string> = {}
  if (parsed.settings && typeof parsed.settings === 'object') {
    for (const [key, value] of Object.entries(parsed.settings)) {
      if (typeof value === 'string') settings[key] = value.slice(0, 1000)
    }
  }

  return { snapshot: { history, stickers, settings }, createdFiles, skippedItems, source: 'portable' }
}

function parseLegacyJson(buffer: Buffer, imagesDir: string): PreparedBackup {
  const parsed = JSON.parse(buffer.toString('utf8'))
  if (!Array.isArray(parsed)) throw new Error('旧版 JSON 备份必须是记录数组。')

  const history: BackupHistoryItem[] = []
  const createdFiles: string[] = []
  let skippedItems = 0
  for (const rawItem of parsed) {
    const item = normalizeHistoryItem(rawItem)
    if (!item) {
      skippedItems++
      continue
    }
    if (item.type === 'image') {
      const image = readImageFile(item.image_path)
      if (!image || !item.image_path) {
        skippedItems++
        continue
      }
      const importedPath = writePreparedAsset(imagesDir, 'legacy_clip', safeExtension(item.image_path), image)
      item.image_path = importedPath
      item.content_hash = item.content_hash || sha256(image)
      createdFiles.push(importedPath)
    }
    history.push(item)
  }

  return {
    snapshot: { history, stickers: [], settings: {} },
    createdFiles,
    skippedItems,
    source: 'legacy-json',
  }
}

export function readBackupFile(filePath: string, imagesDir: string, stickersDir: string): PreparedBackup {
  const stat = fs.statSync(filePath)
  if (!stat.isFile() || stat.size > MAX_BACKUP_BYTES) throw new Error('备份文件无效或超过 1 GB。')
  const buffer = fs.readFileSync(filePath)
  if (path.extname(filePath).toLowerCase() === '.json') return parseLegacyJson(buffer, imagesDir)
  return parsePortableBackup(buffer, imagesDir, stickersDir)
}

export function removePreparedFiles(filePaths: string[]): void {
  for (const filePath of filePaths) {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (error) {
      console.error('Failed to remove prepared backup asset:', error)
    }
  }
}
