import { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, screen, protocol } from 'electron'
import path from 'path'
import fs from 'fs'
import { initDatabaseAsync, closeDatabase, getSetting } from './database'
import { startMonitor, stopMonitor } from './clipboard-monitor'
import { startScheduler, stopScheduler } from './scheduler'
import { registerIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

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

      if (!filePath || !fs.existsSync(filePath)) {
        console.error('local-asset: file not found:', filePath)
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
    width: 420,
    height: 650,
    minWidth: 320,
    minHeight: 400,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false
    }
  })

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Open DevTools in dev mode
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const autoHide = getSetting('auto_hide')
      if (autoHide !== 'false') {
        mainWindow.hide()
      }
    }
  })

  mainWindow.on('close', (e) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  const iconPath = path.join(app.getAppPath(), 'resources', 'tray-icon.png')

  let trayIcon: nativeImage
  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    if (trayIcon.isEmpty()) throw new Error('Empty icon')
  } catch {
    trayIcon = createFallbackTrayIcon()
  }

  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }))
  tray.setToolTip('剪贴板管理器')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主窗口',
      click: () => {
        showWindow()
      }
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
  tray.on('double-click', () => {
    showWindow()
  })
}

function createFallbackTrayIcon(): nativeImage {
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
  if (mainWindow && !mainWindow.isDestroyed()) {
    const cursorPoint = screen.getCursorScreenPoint()
    const currentDisplay = screen.getDisplayNearestPoint(cursorPoint)

    if (mainWindow.isVisible()) {
      mainWindow.focus()
    } else {
      const [winWidth, winHeight] = mainWindow.getSize()
      const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = currentDisplay.workArea

      const x = Math.round(displayX + (displayWidth - winWidth) / 2)
      const y = Math.round(displayY + (displayHeight - winHeight) / 2)

      mainWindow.setPosition(x, y)
      mainWindow.show()
      mainWindow.focus()
    }
  }
}

function registerGlobalShortcut() {
  const hotkey = getSetting('hotkey') || 'Ctrl+Shift+V'
  try {
    globalShortcut.register(hotkey, () => {
      showWindow()
    })
  } catch (e) {
    console.error('Failed to register global shortcut:', e)
    try {
      globalShortcut.register('Ctrl+Shift+V', () => {
        showWindow()
      })
    } catch (e2) {
      console.error('Fallback shortcut also failed:', e2)
    }
  }
}

app.whenReady().then(async () => {
  // Register custom protocol for serving local files
  registerCustomProtocol()

  // Initialize database
  await initDatabaseAsync()

  // Register IPC handlers
  registerIpcHandlers()

  // Create UI
  createWindow()
  createTray()

  // Start services
  startMonitor(500)
  startScheduler()

  // Register global shortcut
  registerGlobalShortcut()
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
