import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // History
  getHistory: (search: string = '', filter: string = 'all', folder: string = '', sort: 'recent' | 'frequent' = 'recent') =>
    ipcRenderer.invoke('history:list', search, filter, folder, sort),
  togglePin: (id: number) => ipcRenderer.invoke('history:togglePin', id),
  toggleFavorite: (id: number) => ipcRenderer.invoke('history:toggleFavorite', id),
  deleteHistory: (id: number) => ipcRenderer.invoke('history:delete', id),
  clearAllHistory: () => ipcRenderer.invoke('history:clearAll'),
  batchDeleteHistory: (ids: number[]) => ipcRenderer.invoke('history:batchDelete', ids),
  copyToClipboard: (id: number) => ipcRenderer.invoke('history:copyToClipboard', id),
  writeTextToClipboard: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
  getFavoriteFolders: () => ipcRenderer.invoke('favorites:folders'),
  updateFavoriteMetadata: (id: number, folder: string, tags: string) => ipcRenderer.invoke('favorites:updateMetadata', id, folder, tags),
  moveFavorite: (id: number, direction: 'up' | 'down') => ipcRenderer.invoke('favorites:move', id, direction),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximizeWindow: (isMaximized: boolean) => ipcRenderer.invoke('window:toggleMaximize', isMaximized),
  isWindowMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  onWindowMaximizedChanged: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => callback(isMaximized)
    ipcRenderer.on('window:maximized-changed', listener)
    return () => ipcRenderer.removeListener('window:maximized-changed', listener)
  },
  getHistoryStats: () => ipcRenderer.invoke('history:stats'),
  onHistoryChanged: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('history:changed', listener)
    return () => ipcRenderer.removeListener('history:changed', listener)
  },
  openExternalUrl: (url: string) => ipcRenderer.invoke('url:openExternal', url),

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  setHotkey: (hotkey: string) => ipcRenderer.invoke('settings:setHotkey', hotkey),

  // Clipboard monitor
  getMonitorPaused: () => ipcRenderer.invoke('monitor:getPaused'),
  setMonitorPaused: (paused: boolean) => ipcRenderer.invoke('monitor:setPaused', paused),
  onMonitorPausedChanged: (callback: (paused: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, paused: boolean) => callback(paused)
    ipcRenderer.on('monitor:paused-changed', listener)
    return () => ipcRenderer.removeListener('monitor:paused-changed', listener)
  },

  // Stickers
  getStickers: () => ipcRenderer.invoke('stickers:list'),
  importStickers: () => ipcRenderer.invoke('stickers:import'),
  deleteSticker: (id: number) => ipcRenderer.invoke('stickers:delete', id),
  sendSticker: (id: number) => ipcRenderer.invoke('stickers:send', id),

  // Emoji
  sendEmoji: (emoji: string) => ipcRenderer.invoke('emoji:send', emoji),

  // Export/Import
  exportHistory: () => ipcRenderer.invoke('history:export'),
  importHistory: () => ipcRenderer.invoke('history:import'),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronApi = typeof api
