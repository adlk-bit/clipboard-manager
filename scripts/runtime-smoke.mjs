import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import initSqlJs from 'sql.js'
import { runEfficiencySmoke } from './runtime-efficiency.mjs'

const repoRoot = path.resolve(import.meta.dirname, '..')
const electronExe = process.env.RUNTIME_EXECUTABLE || path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
const isPackagedRuntime = Boolean(process.env.RUNTIME_EXECUTABLE)
const profileDir = await mkdtemp(path.join(os.tmpdir(), 'clipboard-manager-runtime-'))

async function seedRuntimeProfile() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(repoRoot, 'node_modules', 'sql.js', 'dist', file),
  })
  const database = new SQL.Database()
  database.run(`
    CREATE TABLE clipboard_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT,
      image_path TEXT,
      is_pinned INTEGER DEFAULT 0,
      is_favorite INTEGER DEFAULT 0,
      use_count INTEGER NOT NULL DEFAULT 1,
      last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      content_hash TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      favorite_folder TEXT NOT NULL DEFAULT '',
      favorite_tags TEXT NOT NULL DEFAULT '',
      favorite_sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)
  database.run(
    'INSERT INTO clipboard_history (type, content, is_favorite, favorite_folder, favorite_tags) VALUES (?, ?, 1, ?, ?)',
    ['text', '客户手机 13812345678', '工作', '客户,紧急']
  )
  database.run('UPDATE clipboard_history SET is_pinned = 1 WHERE id = 1')
  for (const content of ['Alpha\n\nBeta\nAlpha', 'Gamma\nBeta', 'https://example.com/path', 'Budget 100% A_B']) {
    database.run('INSERT INTO clipboard_history (type, content) VALUES (?, ?)', ['text', content])
  }
  const fixtureImage = path.join(profileDir, 'images', 'fixture.png')
  await mkdir(path.dirname(fixtureImage), { recursive: true })
  await writeFile(fixtureImage, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'))
  database.run('INSERT INTO clipboard_history (type, image_path) VALUES (?, ?)', ['image', fixtureImage])
  await writeFile(path.join(profileDir, 'clipboard.db'), Buffer.from(database.export()))
  database.close()
}

async function waitForRenderer(port, type = 'page') {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json())
      const target = targets.find((item) => item.type === type && item.webSocketDebuggerUrl)
      if (target) return target.webSocketDebuggerUrl
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error('Electron renderer did not expose a debugging target')
}

async function fetchWithRetry(input, init) {
  let lastError
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await fetch(input, init)
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  throw lastError
}

async function connect(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let nextId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const entry = pending.get(message.id)
    if (!entry) return
    pending.delete(message.id)
    if (message.error) entry.reject(new Error(message.error.message))
    else entry.resolve(message.result)
  })

  return {
    evaluate(expression) {
      const id = ++nextId
      socket.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true },
      }))
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
    },
    captureScreenshot() {
      const id = ++nextId
      socket.send(JSON.stringify({ id, method: 'Page.captureScreenshot', params: { format: 'png' } }))
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
    },
    close() { socket.close() },
  }
}

async function waitForApi(cdp) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      const ready = await cdp.evaluate("typeof window.api?.getMonitorPaused === 'function'")
      if (ready.result.value === true) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Electron preload API was not ready')
}

async function runElectron(port, assertion) {
  const testClipboard = process.env.RUNTIME_COPY_TESTS === '1'
  const child = spawn(electronExe, [
    `--remote-debugging-port=${port}`,
    ...(testClipboard ? [`--inspect=127.0.0.1:${port + 100}`] : []),
    `--user-data-dir=${profileDir}`,
    ...(isPackagedRuntime ? [] : [repoRoot]),
    '--runtime-smoke-test',
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CLIPBOARD_MANAGER_USER_DATA_DIR: profileDir },
  })
  let stderr = ''
  let mainDebugger
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

  try {
    const debuggerUrl = await waitForRenderer(port)
    const cdp = await connect(debuggerUrl)
    try {
      await waitForApi(cdp)
      if (testClipboard) {
        mainDebugger = await connect(await waitForRenderer(port + 100, 'node'))
        cdp.resizeWindow = async (width, height) => {
          await mainDebugger.evaluate(`process.getBuiltinModule('module').createRequire(process.cwd() + '/runtime.cjs')('electron').BrowserWindow.getAllWindows()[0].setSize(${width}, ${height})`)
        }
        cdp.verifyHiddenWindow = async () => {
          const result = await mainDebugger.evaluate("process.getBuiltinModule('module').createRequire(process.cwd() + '/runtime.cjs')('electron').BrowserWindow.getAllWindows()[0].isVisible()")
          assert.equal(result.result?.value, false, 'Quick copy must hide the window')
        }
        const captured = await mainDebugger.evaluate(`(() => {
          const electron = process.getBuiltinModule('module').createRequire(process.cwd() + '/runtime.cjs')('electron')
          const cb = electron.clipboard
          if (cb.availableFormats().some(format => !['text/plain', 'text/html', 'text/rtf', 'image/png'].includes(format))) return false
          globalThis.__smokeClipboard = { cb, data: { text: cb.readText(), html: cb.readHTML(), rtf: cb.readRTF(), image: cb.readImage() }, expected: null }
          return true
        })()`)
        if (captured.result?.value === true) {
          cdp.verifyClipboard = async (expected) => {
            const result = await mainDebugger.evaluate(`(() => {
              const state = globalThis.__smokeClipboard
              const matches = state.cb.readText() === ${JSON.stringify(expected)}
              if (matches) state.expected = ${JSON.stringify(expected)}
              return matches
            })()`)
            assert.equal(result.result?.value, true, 'OS clipboard must match the expected synthetic text')
          }
        } else console.log('OS clipboard copy checks skipped: preserving unsupported clipboard formats.')
      }
      await assertion(cdp)
    } finally {
      cdp.close()
    }
  } catch (error) {
    throw new Error(`${error.message}\nElectron stderr:\n${stderr}`)
  } finally {
    if (mainDebugger) {
      try {
        const restored = await mainDebugger.evaluate(`(() => {
          const state = globalThis.__smokeClipboard
          let restored = true
          if (state && state.expected !== null && state.cb.readText() === state.expected) {
            state.cb.write(state.data)
            restored = state.cb.readText() === state.data.text && state.cb.readHTML() === state.data.html && state.cb.readRTF() === state.data.rtf
          }
          delete globalThis.__smokeClipboard
          return restored
        })()`)
        assert.equal(restored.result?.value, true, 'Test clipboard restoration failed')
      } catch { console.warn('Could not restore the test clipboard; please inspect the last copy operation.'); process.exitCode = 1 }
      finally { mainDebugger.close() }
    }
    child.kill()
    await new Promise((resolve) => child.once('exit', resolve))
  }
}

try {
  await seedRuntimeProfile()
  await runElectron(9321, async (cdp) => {
    if (process.env.RUNTIME_EFFICIENCY_ONLY === '1') {
      const setup = await cdp.evaluate(`(async () => {
        const deadline = Date.now() + 5_000
        while (!document.querySelector('button[aria-label="设置"]') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50))
        document.querySelector('button[aria-label="设置"]').click()
        await new Promise(resolve => setTimeout(resolve, 200))
        Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'English').click()
        await new Promise(resolve => setTimeout(resolve, 200))
      })()`)
      assert.equal(setup.exceptionDetails, undefined)
      await runEfficiencySmoke(cdp)
      return
    }
    const initial = await cdp.evaluate('window.api.getMonitorPaused()')
    assert.equal(initial.result.value, false)

    const historyFeatures = await cdp.evaluate(`(async () => {
      const deadline = Date.now() + 5_000
      let card = document.querySelector('.history-card')
      while (!card && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        card = document.querySelector('.history-card')
      }
      const maskedText = card?.querySelector('p')?.textContent || ''
      const reveal = card?.querySelector('button[aria-label="显示敏感内容"]')
      reveal?.click()
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const revealedText = card?.querySelector('p')?.textContent || ''
      const tagMatches = await window.api.getHistory('紧急', 'all', '', 'recent')
      const folderMatches = await window.api.getHistory('工作', 'all', '', 'recent')
      return {
        maskedText,
        rawInitiallyHidden: !maskedText.includes('13812345678'),
        hasRevealAction: Boolean(reveal),
        revealedText,
        tagMatchIds: tagMatches.map((item) => item.id),
        folderMatchIds: folderMatches.map((item) => item.id),
      }
    })()`)
    assert.deepEqual(historyFeatures.result.value, {
      maskedText: '客户手机 138••••5678',
      rawInitiallyHidden: true,
      hasRevealAction: true,
      revealedText: '客户手机 13812345678',
      tagMatchIds: [1],
      folderMatchIds: [1],
    })

    const alwaysOnTop = await cdp.evaluate(`(async () => {
      const initial = await window.api.getWindowAlwaysOnTop()
      const pinButton = document.querySelector('button[aria-label="窗口置顶"]')
      pinButton?.click()
      const deadline = Date.now() + 2_000
      let applied = await window.api.getWindowAlwaysOnTop()
      while ((!applied || pinButton?.getAttribute('aria-pressed') !== 'true') && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25))
        applied = await window.api.getWindowAlwaysOnTop()
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      return {
        initial,
        hasPinButton: Boolean(pinButton),
        applied,
        pressed: pinButton?.getAttribute('aria-pressed') === 'true',
        activeStyle: pinButton?.classList.contains('window-control-button-active') === true,
      }
    })()`)
    assert.deepEqual(alwaysOnTop.result.value, {
      initial: false,
      hasPinButton: true,
      applied: true,
      pressed: true,
      activeStyle: true,
    })
    if (process.env.RUNTIME_HISTORY_SCREENSHOT_PATH) {
      await cdp.evaluate(`(async () => {
        document.querySelector('button[aria-label="重新隐藏敏感内容"]')?.click()
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      })()`)
      const screenshot = await cdp.captureScreenshot()
      await writeFile(process.env.RUNTIME_HISTORY_SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'))
    }

    const emojiUi = await cdp.evaluate(`(async () => {
      const deadline = Date.now() + 5_000
      let emojiNav = document.querySelector('button[aria-label="Emoji"]')
      while (!emojiNav && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50))
        emojiNav = document.querySelector('button[aria-label="Emoji"]')
      }
      emojiNav?.click()
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      return {
        hasNavigationEntry: Boolean(emojiNav),
        heading: document.querySelector('h1')?.textContent,
        hasSearch: Boolean(document.querySelector('input[type="search"]')),
        hasEmojiGrid: document.querySelectorAll('.grid button').length > 0,
      }
    })()`)
    assert.deepEqual(emojiUi.result.value, {
      hasNavigationEntry: true,
      heading: 'Emoji',
      hasSearch: true,
      hasEmojiGrid: true,
    })

    const devicesUi = await cdp.evaluate(`(async () => {
      const devicesNav = document.querySelector('button[aria-label="连接设备"]')
      devicesNav?.click()
      await new Promise((resolve) => setTimeout(resolve, 250))
      const status = await window.api.getMobileSyncStatus()
      return {
        hasNavigationEntry: Boolean(devicesNav),
        heading: document.querySelector('h1')?.textContent,
        hasPairingAction: Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('配对二维码')),
        serviceRunning: status.running,
        portIsValid: Number.isInteger(status.port) && status.port > 0,
      }
    })()`)
    assert.deepEqual(devicesUi.result.value, {
      hasNavigationEntry: true,
      heading: '连接设备',
      hasPairingAction: true,
      serviceRunning: true,
      portIsValid: true,
    })
    const runtimePairing = await cdp.evaluate(`(async () => {
      const status = await window.api.getMobileSyncStatus()
      if (status.addresses.length === 0) return { skipped: true }
      return await window.api.createMobilePairing(status.addresses[0].address)
    })()`)
    if (!runtimePairing.result.value.skipped) {
      assert.equal(runtimePairing.result.value.success, true)
      const pairingUrl = runtimePairing.result.value.pairing.pairingUrl
      const pairingPage = await fetchWithRetry(pairingUrl)
      assert.equal(pairingPage.status, 200)
      assert.match(await pairingPage.text(), /连接手机与电脑/)
      const unauthorizedState = await fetchWithRetry(new URL('/api/state', pairingUrl))
      assert.equal(unauthorizedState.status, 401)
    }
    const invalidEmoji = await cdp.evaluate("window.api.sendEmoji(String.fromCharCode(10))")
    assert.equal(invalidEmoji.result.value.success, false)

    const invalidEditedText = await cdp.evaluate("window.api.writeTextToClipboard('')")
    assert.equal(invalidEditedText.result.value.success, false)

    const settingsUi = await cdp.evaluate(`(async () => {
      const settingsNav = document.querySelector('button[aria-label="设置"]')
      settingsNav?.click()
      await new Promise((resolve) => setTimeout(resolve, 150))

      const darkToggle = document.querySelector('button[role="switch"]')
      const privacyToggle = document.querySelectorAll('button[role="switch"]')[1]
      const trackBefore = darkToggle?.getBoundingClientRect()
      const knobBefore = darkToggle?.querySelector('span')?.getBoundingClientRect()
      darkToggle?.click()
      await new Promise((resolve) => setTimeout(resolve, 200))
      const trackAfter = darkToggle?.getBoundingClientRect()
      const knobAfter = darkToggle?.querySelector('span')?.getBoundingClientRect()

      const privacyInitiallyEnabled = privacyToggle?.getAttribute('aria-checked') === 'true'
      privacyToggle?.click()
      await new Promise((resolve) => setTimeout(resolve, 100))
      const storedSensitivePreviewDisabled = await window.api.getSetting('sensitive_preview')
      privacyToggle?.click()
      await new Promise((resolve) => setTimeout(resolve, 100))

      const englishButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'English')
      englishButton?.click()
      await new Promise((resolve) => setTimeout(resolve, 200))

      return {
        hasSettingsNavigation: Boolean(settingsNav),
        heading: document.querySelector('h1')?.textContent,
        documentLanguage: document.documentElement.lang,
        documentTitle: document.title,
        hasEnglishSettingsNavigation: Boolean(document.querySelector('button[aria-label="Settings"]')),
        storedLanguage: await window.api.getSetting('language'),
        storedDarkMode: await window.api.getSetting('dark_mode'),
        privacyInitiallyEnabled,
        storedSensitivePreviewDisabled,
        storedSensitivePreviewRestored: await window.api.getSetting('sensitive_preview'),
        knobStartsLeft: Boolean(trackBefore && knobBefore && knobBefore.left + knobBefore.width / 2 < trackBefore.left + trackBefore.width / 2),
        knobEndsRight: Boolean(trackAfter && knobAfter && knobAfter.left + knobAfter.width / 2 > trackAfter.left + trackAfter.width / 2),
        knobInsideTrack: Boolean(
          trackBefore && knobBefore && trackAfter && knobAfter
          && knobBefore.left >= trackBefore.left && knobBefore.right <= trackBefore.right
          && knobAfter.left >= trackAfter.left && knobAfter.right <= trackAfter.right
        ),
      }
    })()`)
    assert.deepEqual(settingsUi.result.value, {
      hasSettingsNavigation: true,
      heading: 'Settings',
      documentLanguage: 'en',
      documentTitle: 'Clipboard Manager',
      hasEnglishSettingsNavigation: true,
      storedLanguage: 'en',
      storedDarkMode: 'true',
      privacyInitiallyEnabled: true,
      storedSensitivePreviewDisabled: 'false',
      storedSensitivePreviewRestored: 'true',
      knobStartsLeft: true,
      knobEndsRight: true,
      knobInsideTrack: true,
    })
    if (process.env.RUNTIME_SCREENSHOT_PATH) {
      const screenshot = await cdp.captureScreenshot()
      await writeFile(process.env.RUNTIME_SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'))
    }
    const restoredDarkMode = await cdp.evaluate(`(async () => {
      document.querySelector('button[role="switch"]')?.click()
      await new Promise((resolve) => setTimeout(resolve, 200))
      return window.api.getSetting('dark_mode')
    })()`)
    assert.equal(restoredDarkMode.result.value, 'false')

    await runEfficiencySmoke(cdp)

    const paused = await cdp.evaluate('window.api.setMonitorPaused(true)')
    assert.equal(paused.result.value, true)
    // Database writes are deliberately debounced to batch rapid clipboard events.
    await new Promise((resolve) => setTimeout(resolve, 800))
  })

  if (process.env.RUNTIME_EFFICIENCY_ONLY !== '1') await runElectron(9322, async (cdp) => {
    const restored = await cdp.evaluate('window.api.getMonitorPaused()')
    assert.equal(restored.result.value, true)
    const restoredFeatureSettings = await cdp.evaluate(`(async () => ({
      alwaysOnTop: await window.api.getWindowAlwaysOnTop(),
      sensitivePreview: await window.api.getSetting('sensitive_preview'),
    }))()`)
    assert.deepEqual(restoredFeatureSettings.result.value, { alwaysOnTop: true, sensitivePreview: 'true' })
    const restoredLanguage = await cdp.evaluate(`(async () => {
      const deadline = Date.now() + 5_000
      while (!document.querySelector('button[aria-label="Settings"]') && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      return {
        setting: await window.api.getSetting('language'),
        heading: document.querySelector('h1')?.textContent,
        hasEnglishNavigation: Boolean(document.querySelector('button[aria-label="Settings"]')),
      }
    })()`)
    assert.deepEqual(restoredLanguage.result.value, {
      setting: 'en',
      heading: 'Clipboard History',
      hasEnglishNavigation: true,
    })
    await cdp.evaluate("window.api.setSetting('language', 'zh-CN')")
    await cdp.evaluate('window.api.setWindowAlwaysOnTop(false)')
    const resumed = await cdp.evaluate('window.api.setMonitorPaused(false)')
    assert.equal(resumed.result.value, false)
  })

  if (process.env.RUNTIME_EFFICIENCY_ONLY !== '1') console.log('Runtime smoke passed: sensitive previews, metadata search, persistent always-on-top, Emoji UI, phone device UI/service, settings, validation, and pause persistence work across restart.')
} finally {
  await rm(profileDir, { recursive: true, force: true })
}
