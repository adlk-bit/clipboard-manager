import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // History
  getHistory: (search: string = '', filter: string = 'all') =>
    ipcRenderer.invoke('history:list', search, filter),
  togglePin: (id: number) => ipcRenderer.invoke('history:togglePin', id),
  toggleFavorite: (id: number) => ipcRenderer.invoke('history:toggleFavorite', id),
  deleteHistory: (id: number) => ipcRenderer.invoke('history:delete', id),
  clearAllHistory: () => ipcRenderer.invoke('history:clearAll'),
  batchDeleteHistory: (ids: number[]) => ipcRenderer.invoke('history:batchDelete', ids),
  copyToClipboard: (item: any) => ipcRenderer.invoke('history:copyToClipboard', item),

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),

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
