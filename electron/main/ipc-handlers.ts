import { ipcMain, dialog, clipboard, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import {
  getHistoryList,
  togglePin,
  toggleFavorite,
  deleteHistory,
  clearAllHistory,
  batchDeleteHistory,
  getSetting,
  setSetting,
  insertSticker,
  getStickerList,
  deleteSticker,
  exportHistory,
  importHistory,
  HistoryItem,
  StickerItem
} from './database'

let stickersDir: string | null = null

function getStickersDir(): string {
  if (!stickersDir) {
    stickersDir = path.join(app.getPath('userData'), 'stickers')
    if (!fs.existsSync(stickersDir)) {
      fs.mkdirSync(stickersDir, { recursive: true })
    }
  }
  return stickersDir
}

export function registerIpcHandlers() {
  // ---- History ----
  ipcMain.handle('history:list', (_event, search: string, filter: string) => {
    return getHistoryList(search, filter as 'all' | 'favorites')
  })

  ipcMain.handle('history:togglePin', (_event, id: number) => {
    togglePin(id)
  })

  ipcMain.handle('history:toggleFavorite', (_event, id: number) => {
    toggleFavorite(id)
  })

  ipcMain.handle('history:delete', (_event, id: number) => {
    deleteHistory(id)
  })

  ipcMain.handle('history:clearAll', () => {
    clearAllHistory()
  })

  ipcMain.handle('history:batchDelete', (_event, ids: number[]) => {
    return batchDeleteHistory(ids)
  })

  ipcMain.handle('history:copyToClipboard', (_event, item: HistoryItem) => {
    if (item.type === 'text' && item.content) {
      clipboard.writeText(item.content)
      // Verify write
      const written = clipboard.readText()
      if (written === item.content) {
        return { success: true, type: 'text' }
      }
      return { success: false, type: 'text', error: 'Write verification failed' }
    } else if (item.type === 'image' && item.image_path) {
      if (fs.existsSync(item.image_path)) {
        try {
          const img = nativeImage.createFromPath(item.image_path)
          if (!img.isEmpty()) {
            clipboard.writeImage(img)
            return { success: true, type: 'image' }
          }
        } catch (e) {
          return { success: false, type: 'image', error: String(e) }
        }
      }
      return { success: false, type: 'image', error: 'Image file not found' }
    }
    return { success: false, error: 'Invalid item' }
  })

  // ---- Settings ----
  ipcMain.handle('settings:get', (_event, key: string) => {
    return getSetting(key)
  })

  ipcMain.handle('settings:set', (_event, key: string, value: string) => {
    setSetting(key, value)
  })

  // ---- Stickers ----
  ipcMain.handle('stickers:list', () => {
    return getStickerList()
  })

  ipcMain.handle('stickers:import', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }]
    })

    if (result.canceled || result.filePaths.length === 0) return []

    const imported: StickerItem[] = []
    for (const filePath of result.filePaths) {
      const filename = path.basename(filePath)
      const destPath = path.join(getStickersDir(), `sticker_${Date.now()}_${filename}`)
      fs.copyFileSync(filePath, destPath)

      const name = path.basename(filePath, path.extname(filePath))
      insertSticker(name, destPath)
      imported.push({ id: 0, name, image_path: destPath, created_at: new Date().toISOString() })
    }

    return getStickerList()
  })

  ipcMain.handle('stickers:delete', (_event, id: number) => {
    deleteSticker(id)
    return getStickerList()
  })

  ipcMain.handle('stickers:send', (_event, imagePath: string) => {
    if (fs.existsSync(imagePath)) {
      try {
        const img = nativeImage.createFromPath(imagePath)
        if (!img.isEmpty()) {
          clipboard.writeImage(img)
          return { success: true }
        }
      } catch (e) {
        return { success: false, error: String(e) }
      }
    }
    return { success: false, error: 'Image file not found' }
  })

  // ---- Export / Import ----
  ipcMain.handle('history:export', async () => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
      defaultPath: `clipboard-backup-${new Date().toISOString().slice(0, 10)}.json`
    })

    if (result.canceled || !result.filePath) return null

    const jsonStr = exportHistory()
    fs.writeFileSync(result.filePath, jsonStr, 'utf-8')
    return result.filePath
  })

  ipcMain.handle('history:import', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    })

    if (result.canceled || result.filePaths.length === 0) return 0

    const jsonStr = fs.readFileSync(result.filePaths[0], 'utf-8')
    return importHistory(jsonStr)
  })
}
