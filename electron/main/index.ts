import { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, screen, protocol, type NativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { initDatabaseAsync, closeDatabase, getSetting, setSetting } from './database'
import { startMonitor, stopMonitor, isMonitorPaused, setMonitorPaused } from './clipboard-monitor'
import { startScheduler, stopScheduler } from './scheduler'
import { registerIpcHandlers } from './ipc-handlers'
import { isManagedAssetPath } from './asset-paths'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let registeredHotkey: string | null = null
const isRuntimeTest = process.argv.includes('--runtime-smoke-test')

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
])

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
}

function registerCustomProtocol() {
  protocol.handle('local-asset', (request) => {
    try {
      // URL format: local-asset://file/<encoded-absolute-path>
      const url = new URL(request.url)
      const encodedPath = url.pathname // e.g. "/C%3A%5CUsers%5C...%5Cimage.png"
      // Remove leading slash added by URL parser
      const filePath = decodeURIComponent(encodedPath.startsWith('/') ? encodedPath.slice(1) : encodedPath)

      if (!filePath || !isManagedAssetPath(filePath) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return new Response('Not Found', { status: 404 })
      }

      const data = fs.readFileSync(filePath)
      const ext = path.extname(filePath).toLowerCase()
      const mimeType = MIME_TYPES[ext] || 'image/png'
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'no-cache',
        }
      })
    } catch (e) {
      console.error('local-asset: Error:', e)
      return new Response('Server Error', { status: 500 })
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 320,
    minHeight: 400,
    frame: false,
    // Resizable transparent frameless windows have unreliable native
    // maximize/unmaximize behavior on Windows. The renderer already paints
    // the entire surface, so an opaque host window keeps the same appearance.
    transparent: false,
    backgroundColor: '#f7f7f8',
    resizable: true,
    skipTaskbar: false,
    alwaysOnTop: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL()
    if (currentUrl && url !== currentUrl) event.preventDefault()
  })

  // Development sessions should be directly inspectable without relying on a
  // global shortcut that may already be owned by an installed release.
  mainWindow.once('ready-to-show', () => {
    if ((process.env.ELECTRON_RENDERER_URL || isRuntimeTest) && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  mainWindow.on('close', (e) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('show', () => {
    mainWindow?.webContents.send('history:changed')
  })

  const notifyMaximizedState = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximized-changed', mainWindow.isMaximized())
    }
  }
  mainWindow.on('maximize', notifyMaximizedState)
  mainWindow.on('unmaximize', notifyMaximizedState)
}

function refreshTrayMenu() {
  if (!tray) return
  const paused = isMonitorPaused()
  tray.setToolTip(paused ? '剪贴板管理器（记录已暂停）' : '剪贴板管理器')
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主窗口',
      click: () => {
        showWindow()
      }
    },
    {
      label: paused ? '恢复记录' : '暂停记录',
      type: 'checkbox',
      checked: paused,
      click: (menuItem) => applyMonitorPaused(menuItem.checked)
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.exit(0)
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

export function applyMonitorPaused(paused: boolean): boolean {
  setMonitorPaused(paused)
  setSetting('monitor_paused', paused ? 'true' : 'false')
  refreshTrayMenu()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('monitor:paused-changed', isMonitorPaused())
  }
  return isMonitorPaused()
}

function createTray() {
  const iconPath = path.join(app.getAppPath(), 'resources', 'tray-icon.png')

  let trayIcon: NativeImage
  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) throw new Error('Empty icon')
  } catch {
    trayIcon = createFallbackTrayIcon()
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }))
  refreshTrayMenu()
  tray.on('double-click', () => {
    showWindow()
  })
}

function createFallbackTrayIcon(): NativeImage {
  const size = 16
  const buffer = Buffer.alloc(size * size * 4)

  for (let i = 0; i < size * size; i++) {
    buffer[i * 4] = 66
    buffer[i * 4 + 1] = 165
    buffer[i * 4 + 2] = 245
    buffer[i * 4 + 3] = 255
  }

  return nativeImage.createFromBuffer(buffer, { width: size, height: size })
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return

  // A minimized BrowserWindow is reported as not visible. Restore it before
  // reading or changing its bounds; moving a minimized/maximized frameless
  // window can produce invalid native coordinates on Windows.
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    return
  }

  if (!mainWindow.isVisible()) {
    // Keep the native maximized state intact when reopening from the tray.
    if (!mainWindow.isMaximized()) {
      const cursorPoint = screen.getCursorScreenPoint()
      const { workArea } = screen.getDisplayNearestPoint(cursorPoint)
      const [winWidth, winHeight] = mainWindow.getSize()
      const x = Math.round(workArea.x + (workArea.width - winWidth) / 2)
      const y = Math.round(workArea.y + (workArea.height - winHeight) / 2)

      if (Number.isSafeInteger(x) && Number.isSafeInteger(y)) {
        mainWindow.setPosition(x, y)
      }
    }

    mainWindow.show()
  }

  mainWindow.focus()
}

function isSupportedHotkey(hotkey: string): boolean {
  const parts = hotkey.split('+')
  const key = parts.pop()
  const modifiers = parts
  const supportedKey = /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Tab|Up|Down|Left|Right|Escape|Enter|Backspace|Delete|Home|End|PageUp|PageDown|Insert)$/.test(key || '')
  const supportedModifiers = modifiers.length > 0
    && modifiers.every((modifier) => ['Ctrl', 'Alt', 'Shift', 'Super'].includes(modifier))
    && new Set(modifiers).size === modifiers.length

  return supportedKey && supportedModifiers
}

export function hideWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide()
}

export function updateGlobalShortcut(rawHotkey: string): { success: boolean; hotkey?: string; error?: string } {
  const hotkey = rawHotkey.trim()
  if (!isSupportedHotkey(hotkey)) {
    return { success: false, error: '快捷键格式无效，请至少组合一个修饰键和一个按键。' }
  }

  const previousHotkey = registeredHotkey
  if (previousHotkey) globalShortcut.unregister(previousHotkey)

  try {
    const registered = globalShortcut.register(hotkey, showWindow)
    if (!registered) {
      if (previousHotkey) globalShortcut.register(previousHotkey, showWindow)
      return { success: false, error: '该快捷键已被其他应用占用。' }
    }

    registeredHotkey = hotkey
    return { success: true, hotkey }
  } catch (e) {
    console.error('Failed to register global shortcut:', e)
    if (previousHotkey) {
      try {
        globalShortcut.register(previousHotkey, showWindow)
      } catch (restoreError) {
        console.error('Failed to restore previous global shortcut:', restoreError)
      }
    }
    return { success: false, error: '无法注册该快捷键。' }
  }
}

function registerGlobalShortcut() {
  const hotkey = getSetting('hotkey') || 'Ctrl+Shift+V'
  const result = updateGlobalShortcut(hotkey)
  if (result.success) return

  console.error('Failed to register saved global shortcut:', result.error)
  const fallback = updateGlobalShortcut('Ctrl+Shift+V')
  if (fallback.success) {
    setSetting('hotkey', 'Ctrl+Shift+V')
  } else {
    console.error('Fallback shortcut also failed:', fallback.error)
  }
}

app.whenReady().then(async () => {
  // Register custom protocol for serving local files
  registerCustomProtocol()

  // Initialize database
  await initDatabaseAsync()

  // Privacy pause persists until the user explicitly resumes recording.
  setMonitorPaused(getSetting('monitor_paused') === 'true')

  // Register IPC handlers
  registerIpcHandlers(updateGlobalShortcut, hideWindow, applyMonitorPaused)

  // Create UI
  createWindow()
  createTray()

  // Start services
  if (!isRuntimeTest) {
    startMonitor(500, () => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('history:changed')
    })
    startScheduler(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('history:changed')
    })

    // Register global shortcut
    registerGlobalShortcut()
  }
})

app.on('window-all-closed', () => {
  // Don't quit, keep running in tray
})

app.on('will-quit', () => {
  stopMonitor()
  stopScheduler()
  globalShortcut.unregisterAll()
  closeDatabase()
})

app.on('activate', () => {
  showWindow()
})
