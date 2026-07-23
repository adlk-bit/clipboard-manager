import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // History
  getHistory: (search: string = '', filter: string = 'all', folder: string = '') =>
    ipcRenderer.invoke('history:list', search, filter, folder),
  togglePin: (id: number) => ipcRenderer.invoke('history:togglePin', id),
  toggleFavorite: (id: number) => ipcRenderer.invoke('history:toggleFavorite', id),
  deleteHistory: (id: number) => ipcRenderer.invoke('history:delete', id),
  clearAllHistory: () => ipcRenderer.invoke('history:clearAll'),
  batchDeleteHistory: (ids: number[]) => ipcRenderer.invoke('history:batchDelete', ids),
  copyToClipboard: (item: any) => ipcRenderer.invoke('history:copyToClipboard', item),
  getFavoriteFolders: () => ipcRenderer.invoke('favorites:folders'),
  updateFavoriteMetadata: (id: number, folder: string, tags: string) => ipcRenderer.invoke('favorites:updateMetadata', id, folder, tags),
  moveFavorite: (id: number, direction: 'up' | 'down') => ipcRenderer.invoke('favorites:move', id, direction),
  hideWindow: () => ipcRenderer.invoke('window:hide'),
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

  // Stickers
  getStickers: () => ipcRenderer.invoke('stickers:list'),
  importStickers: () => ipcRenderer.invoke('stickers:import'),
  deleteSticker: (id: number) => ipcRenderer.invoke('stickers:delete', id),
  sendSticker: (imagePath: string) => ipcRenderer.invoke('stickers:send', imagePath),

  // Export/Import
  exportHistory: () => ipcRenderer.invoke('history:export'),
  importHistory: () => ipcRenderer.invoke('history:import'),
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronApi = typeof api
