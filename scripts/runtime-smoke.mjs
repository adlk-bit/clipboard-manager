import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const electronExe = process.env.RUNTIME_EXECUTABLE || path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
const isPackagedRuntime = Boolean(process.env.RUNTIME_EXECUTABLE)
const profileDir = await mkdtemp(path.join(os.tmpdir(), 'clipboard-manager-runtime-'))

async function waitForRenderer(port) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json())
      const target = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl)
      if (target) return target.webSocketDebuggerUrl
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150))
  }
  throw new Error('Electron renderer did not expose a debugging target')
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
  const child = spawn(electronExe, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    ...(isPackagedRuntime ? [] : [repoRoot]),
    '--runtime-smoke-test',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

  try {
    const debuggerUrl = await waitForRenderer(port)
    const cdp = await connect(debuggerUrl)
    try {
      await waitForApi(cdp)
      await assertion(cdp)
    } finally {
      cdp.close()
    }
  } catch (error) {
    throw new Error(`${error.message}\nElectron stderr:\n${stderr}`)
  } finally {
    child.kill()
    await new Promise((resolve) => child.once('exit', resolve))
  }
}

try {
  await runElectron(9321, async (cdp) => {
    const initial = await cdp.evaluate('window.api.getMonitorPaused()')
    assert.equal(initial.result.value, false)

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
      const pairingPage = await fetch(pairingUrl)
      assert.equal(pairingPage.status, 200)
      assert.match(await pairingPage.text(), /连接手机与电脑/)
      const unauthorizedState = await fetch(new URL('/api/state', pairingUrl))
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
      const trackBefore = darkToggle?.getBoundingClientRect()
      const knobBefore = darkToggle?.querySelector('span')?.getBoundingClientRect()
      darkToggle?.click()
      await new Promise((resolve) => setTimeout(resolve, 200))
      const trackAfter = darkToggle?.getBoundingClientRect()
      const knobAfter = darkToggle?.querySelector('span')?.getBoundingClientRect()

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

    const paused = await cdp.evaluate('window.api.setMonitorPaused(true)')
    assert.equal(paused.result.value, true)
    // Database writes are deliberately debounced to batch rapid clipboard events.
    await new Promise((resolve) => setTimeout(resolve, 800))
  })

  await runElectron(9322, async (cdp) => {
    const restored = await cdp.evaluate('window.api.getMonitorPaused()')
    assert.equal(restored.result.value, true)
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
    const resumed = await cdp.evaluate('window.api.setMonitorPaused(false)')
    assert.equal(resumed.result.value, false)
  })

  console.log('Runtime smoke passed: Emoji UI, phone device UI/service, settings switch geometry, language persistence, clipboard input validation, and pause persistence work across restart.')
} finally {
  await rm(profileDir, { recursive: true, force: true })
}
