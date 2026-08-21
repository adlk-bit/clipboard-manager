import { BrowserWindow, ipcMain, dialog, clipboard, nativeImage, shell } from 'electron'
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
  getStickerById,
  deleteSticker,
  getHistoryById,
  getBackupSnapshot,
  importBackupSnapshot,
  getFavoriteFolders,
  updateFavoriteMetadata,
  moveFavorite,
  enforceHistoryLimit,
  getHistoryStats,
  recordHistoryUse
} from './database'
import { normalizeHttpUrl } from '../../shared/url'
import { isMonitorPaused, markClipboardHistoryItemCopied } from './clipboard-monitor'
import { getHistoryImagesDir, getStickersDir, isPathInside } from './asset-paths'
import { readBackupFile, removePreparedFiles, writePortableBackup } from './backup'
import { getMobileSyncService } from './mobile-sync'

export interface HotkeyUpdateResult {
  success: boolean
  hotkey?: string
  error?: string
}

const SETTINGS_VALIDATORS: Record<string, (value: string) => boolean> = {
  retention_days: (value) => ['0', '1', '3', '5'].includes(value),
  dark_mode: (value) => value === 'true' || value === 'false',
  language: (value) => value === 'zh-CN' || value === 'en',
  max_history_items: (value) => ['100', '300', '500', '1000'].includes(value),
  max_image_size_mb: (value) => ['1', '5', '10', '20'].includes(value),
  hotkey: (value) => value.length <= 80,
  monitor_paused: (value) => value === 'true' || value === 'false',
}

function validId(id: unknown): id is number {
  return Number.isInteger(id) && Number(id) > 0
}

function safeString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

export function registerIpcHandlers(
  updateHotkey: (hotkey: string) => HotkeyUpdateResult,
  hideMainWindow: () => void,
  applyMonitorPaused: (paused: boolean) => boolean,
  refreshApplicationLanguage: () => void,
) {
  // ---- History ----
  ipcMain.handle('history:list', (_event, search: unknown, filter: unknown, folder: unknown = '', sort: unknown = 'recent') => {
    const safeFilter = filter === 'favorites' ? 'favorites' : 'all'
    return getHistoryList(
      safeString(search, 500),
      safeFilter,
      safeFilter === 'favorites' ? safeString(folder, 120) : '',
      sort === 'frequent' ? 'frequent' : 'recent'
    )
  })

  ipcMain.handle('history:togglePin', (_event, id: unknown) => {
    if (validId(id)) togglePin(id)
  })

  ipcMain.handle('history:toggleFavorite', (_event, id: unknown) => {
    if (validId(id)) toggleFavorite(id)
  })

  ipcMain.handle('history:delete', (_event, id: unknown) => {
    if (validId(id)) deleteHistory(id)
  })

  ipcMain.handle('history:clearAll', () => {
    clearAllHistory()
  })

  ipcMain.handle('history:batchDelete', (_event, ids: unknown) => {
    const safeIds = Array.isArray(ids) ? [...new Set(ids.filter(validId))].slice(0, 1000) : []
    return batchDeleteHistory(safeIds)
  })

  ipcMain.handle('history:copyToClipboard', (event, id: unknown) => {
    if (!validId(id)) return { success: false, error: 'Invalid history item' }
    const item = getHistoryById(id)
    if (!item) return { success: false, error: 'History item not found' }
    if (item.type === 'text' && item.content) {
      clipboard.writeText(item.content)
      // Verify write
      const written = clipboard.readText()
      if (written === item.content) {
        recordHistoryUse(item.id)
        markClipboardHistoryItemCopied({ type: 'text', content: item.content })
        event.sender.send('history:changed')
        return { success: true, type: 'text' }
      }
      return { success: false, type: 'text', error: 'Write verification failed' }
    } else if (item.type === 'image' && item.image_path) {
      if (isPathInside(getHistoryImagesDir(), item.image_path) && fs.existsSync(item.image_path)) {
        try {
          const img = nativeImage.createFromPath(item.image_path)
          if (!img.isEmpty()) {
            clipboard.writeImage(img)
            recordHistoryUse(item.id)
            markClipboardHistoryItemCopied({ type: 'image', content: null, image: img })
            event.sender.send('history:changed')
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

  ipcMain.handle('clipboard:writeText', (_event, text: unknown) => {
    if (typeof text !== 'string' || text.length === 0 || text.length > 10000) {
      return { success: false, type: 'text', error: 'Invalid text content' }
    }

    clipboard.writeText(text)
    return clipboard.readText() === text
      ? { success: true, type: 'text' }
      : { success: false, type: 'text', error: 'Write verification failed' }
  })

  ipcMain.handle('favorites:folders', () => getFavoriteFolders())
  ipcMain.handle('favorites:updateMetadata', (_event, id: unknown, folder: unknown, tags: unknown) => {
    if (!validId(id)) return
    updateFavoriteMetadata(id, safeString(folder, 120), safeString(tags, 500))
  })
  ipcMain.handle('favorites:move', (_event, id: unknown, direction: unknown) => {
    if (!validId(id) || (direction !== 'up' && direction !== 'down')) return false
    return moveFavorite(id, direction)
  })
  ipcMain.handle('window:hide', () => hideMainWindow())
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.handle('window:toggleMaximize', (event, rendererReportsMaximized: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return false

    // The renderer receives maximize/unmaximize events from the main process.
    // Use that event-backed state as a second signal because isMaximized() can
    // briefly lag for a frameless window during a Windows transition.
    const shouldRestore = window.isMaximized() || rendererReportsMaximized === true
    if (shouldRestore) {
      window.unmaximize()
    } else {
      window.maximize()
    }

    return !shouldRestore
  })
  ipcMain.handle('window:isMaximized', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
  ipcMain.handle('window:close', (event) => {
    // Closing the window keeps this tray application's clipboard monitor active.
    BrowserWindow.fromWebContents(event.sender)?.hide()
  })

  ipcMain.handle('url:openExternal', async (_event, rawUrl: unknown) => {
    if (typeof rawUrl !== 'string') return { success: false, error: 'Invalid URL' }

    const url = normalizeHttpUrl(rawUrl)
    if (!url) return { success: false, error: 'Invalid URL' }

    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('Failed to open external URL:', error)
      return { success: false, error: String(error) }
    }
  })

  // ---- Settings ----
  ipcMain.handle('settings:get', (_event, key: unknown) => {
    if (typeof key !== 'string' || !SETTINGS_VALIDATORS[key]) return null
    return getSetting(key)
  })

  ipcMain.handle('settings:set', (_event, key: unknown, value: unknown) => {
    if (typeof key !== 'string' || typeof value !== 'string' || !SETTINGS_VALIDATORS[key]?.(value)) {
      throw new Error('Invalid setting value')
    }
    setSetting(key, value)
    if (key === 'max_history_items') enforceHistoryLimit(parseInt(value, 10))
    if (key === 'language') refreshApplicationLanguage()
  })

  ipcMain.handle('history:stats', () => getHistoryStats())

  ipcMain.handle('settings:setHotkey', (_event, hotkey: unknown) => {
    if (typeof hotkey !== 'string') return { success: false, error: getSetting('language') === 'en' ? 'Invalid shortcut.' : '快捷键格式无效。' }

    const result = updateHotkey(hotkey)
    if (result.success && result.hotkey) setSetting('hotkey', result.hotkey)
    return result
  })

  ipcMain.handle('monitor:getPaused', () => isMonitorPaused())
  ipcMain.handle('monitor:setPaused', (_event, paused: unknown) => {
    if (typeof paused !== 'boolean') throw new Error('Invalid monitor paused value')
    return applyMonitorPaused(paused)
  })

  // ---- Phone sync ----
  ipcMain.handle('mobile:getStatus', () => {
    const service = getMobileSyncService()
    return service?.getStatus() || { running: false, port: null, addresses: [], devices: [], error: getSetting('language') === 'en' ? 'Phone connection service has not started.' : '手机连接服务尚未启动' }
  })

  ipcMain.handle('mobile:createPairing', (_event, address: unknown) => {
    const service = getMobileSyncService()
    if (!service) return { success: false, error: getSetting('language') === 'en' ? 'Phone connection service has not started.' : '手机连接服务尚未启动' }
    try {
      const safeAddress = typeof address === 'string' && address.length <= 45 ? address : undefined
      return { success: true, pairing: service.createPairing(safeAddress) }
    } catch (error) {
      return { success: false, error: String(error instanceof Error ? error.message : error) }
    }
  })

  ipcMain.handle('mobile:removeDevice', (_event, id: unknown) => {
    return typeof id === 'string' ? (getMobileSyncService()?.removeDevice(id) ?? false) : false
  })

  ipcMain.handle('mobile:setOtpEnabled', (_event, id: unknown, enabled: unknown) => {
    return typeof id === 'string' && typeof enabled === 'boolean'
      ? (getMobileSyncService()?.setOtpEnabled(id, enabled) ?? false)
      : false
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

    for (const filePath of result.filePaths) {
      const filename = path.basename(filePath)
      const destPath = path.join(getStickersDir(), `sticker_${Date.now()}_${filename}`)
      fs.copyFileSync(filePath, destPath)

      const name = path.basename(filePath, path.extname(filePath))
      insertSticker(name, destPath)
    }

    return getStickerList()
  })

  ipcMain.handle('stickers:delete', (_event, id: unknown) => {
    if (validId(id)) deleteSticker(id)
    return getStickerList()
  })

  ipcMain.handle('stickers:send', (_event, id: unknown) => {
    const sticker = validId(id) ? getStickerById(id) : null
    if (sticker && isPathInside(getStickersDir(), sticker.image_path) && fs.existsSync(sticker.image_path)) {
      try {
        const img = nativeImage.createFromPath(sticker.image_path)
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

  // ---- Emoji ----
  ipcMain.handle('emoji:send', (_event, emoji: unknown) => {
    if (typeof emoji !== 'string' || emoji.length === 0 || emoji.length > 32 || /[\u0000-\u001f\u007f]/u.test(emoji)) {
      return { success: false, error: 'Invalid emoji' }
    }

    clipboard.writeText(emoji)
    return clipboard.readText() === emoji
      ? { success: true }
      : { success: false, error: 'Write verification failed' }
  })

  // ---- Export / Import ----
  ipcMain.handle('history:export', async () => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'Clipboard Manager Backup', extensions: ['clipbackup'] }],
      defaultPath: `clipboard-backup-${new Date().toISOString().slice(0, 10)}.clipbackup`
    })

    if (result.canceled || !result.filePath) return null
    return writePortableBackup(result.filePath, getBackupSnapshot(), app.getVersion())
  })

  ipcMain.handle('history:import', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Clipboard Manager Backup', extensions: ['clipbackup'] },
        { name: 'Legacy JSON Backup', extensions: ['json'] },
      ]
    })

    if (result.canceled || result.filePaths.length === 0) return { status: 'cancelled' }

    let prepared: ReturnType<typeof readBackupFile> | null = null
    try {
      prepared = readBackupFile(result.filePaths[0], getHistoryImagesDir(), getStickersDir())
      const english = getSetting('language') === 'en'
      const choice = await dialog.showMessageBox({
        type: 'question',
        title: english ? 'Import backup' : '导入备份',
        message: english ? 'Choose how to restore this backup' : '请选择恢复方式',
        detail: english
          ? 'Merge keeps existing data and skips duplicates. Replace overwrites the current history and sticker library.'
          : '合并导入会保留现有数据并跳过重复内容；覆盖现有数据会替换当前历史和贴图库。',
        buttons: english ? ['Merge import', 'Replace existing data', 'Cancel'] : ['合并导入', '覆盖现有数据', '取消'],
        defaultId: 0,
        cancelId: 2,
        noLink: true,
      })
      if (choice.response === 2) {
        removePreparedFiles(prepared.createdFiles)
        return { status: 'cancelled' }
      }

      const mode = choice.response === 1 ? 'replace' : 'merge'
      const imported = importBackupSnapshot(prepared.snapshot, mode)
      refreshApplicationLanguage()
      const restoredMonitorPaused = prepared.snapshot.settings.monitor_paused
      if (restoredMonitorPaused === 'true' || restoredMonitorPaused === 'false') {
        applyMonitorPaused(restoredMonitorPaused === 'true')
      }
      return {
        status: 'success',
        mode,
        source: prepared.source,
        historyCount: imported.historyCount,
        stickerCount: imported.stickerCount,
        skippedItems: prepared.skippedItems,
        skippedDuplicates: imported.skippedDuplicates,
      }
    } catch (error) {
      if (prepared) removePreparedFiles(prepared.createdFiles)
      console.error('Failed to import clipboard backup:', error)
      return { status: 'error', error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('app:getVersion', () => app.getVersion())
}
