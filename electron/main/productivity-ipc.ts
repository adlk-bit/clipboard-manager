import { BrowserWindow, clipboard, ipcMain } from 'electron'
import { clearOcrCache, getOcrStatus, recognizeHistory } from './ocr-service'
import { getTemplates, saveTemplate, deleteTemplate, getSourceApps, getSetting, setSetting } from './database'
import { renderTemplate, parseExcludedApps } from '../../shared/productivity'
import { pasteQueue } from './paste-queue'
import { windowsNative } from './windows-native'
import { getCaptureStats, resetCaptureBaseline } from './clipboard-monitor'
const idValid = (id: unknown): id is number => Number.isInteger(id) && Number(id) > 0
const notify = () => BrowserWindow.getAllWindows().forEach((window) => window.webContents.send('history:changed'))
export function registerProductivityIpc(): void {
  ipcMain.handle('templates:list', () => getTemplates())
  ipcMain.handle('templates:save', (_event, id, title, body) => {
    if (id !== null && !idValid(id)) throw new Error('invalid-template')
    return saveTemplate(id, title, body)
  })
  ipcMain.handle('templates:delete', (_event, id) => { if (idValid(id)) deleteTemplate(id) })
  ipcMain.handle('templates:copy', (_event, id, values) => {
    const item = idValid(id) ? getTemplates().find((item) => item.id === id) : null
    if (!item || !values || typeof values !== 'object' || Array.isArray(values)) throw new Error('invalid-template')
    const text = renderTemplate(item.body, values)
    clipboard.writeText(text)
    if (clipboard.readText() !== text) throw new Error('queue-write-failed')
    return true
  })
  ipcMain.handle('sources:list', () => getSourceApps())
  ipcMain.handle('sources:exclusions', () => parseExcludedApps(getSetting('excluded_apps') || '[]'))
  ipcMain.handle('sources:setExclusions', (_event, apps) => {
    const normalized = parseExcludedApps(JSON.stringify(apps))
    setSetting('excluded_apps', JSON.stringify(normalized)); resetCaptureBaseline()
    return normalized
  })
  ipcMain.handle('capture:status', () => ({ native: windowsNative.available, listener: windowsNative.listening, ...getCaptureStats() }))
  ipcMain.handle('ocr:status', () => getOcrStatus())
  ipcMain.handle('ocr:recognize', async (_event, id, language, force) => {
    if (!idValid(id) || typeof language !== 'string' || !/^(auto|[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*)$/.test(language)) throw new Error('ocr-invalid-request')
    const result = await recognizeHistory(id, language, force === true); notify(); return result
  })
  ipcMain.handle('ocr:clear', (_event, id) => { if (id !== null && !idValid(id)) throw new Error('ocr-invalid-request'); clearOcrCache(id); notify() })
  ipcMain.handle('queue:status', () => pasteQueue.status())
  ipcMain.handle('queue:start', (_event, ids) => { if (!Array.isArray(ids)) throw new Error('queue-invalid-items'); return pasteQueue.start(ids) })
  ipcMain.handle('queue:control', (_event, action) => pasteQueue.control(action))
}
