import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..')
const electronExe = path.join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
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
    close() { socket.close() },
  }
}

async function runElectron(port, assertion) {
  const child = spawn(electronExe, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    repoRoot,
    '--runtime-smoke-test',
  ], { stdio: ['ignore', 'pipe', 'pipe'] })
  let stderr = ''
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

  try {
    const debuggerUrl = await waitForRenderer(port)
    const cdp = await connect(debuggerUrl)
    try {
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

    const invalidEmoji = await cdp.evaluate("window.api.sendEmoji(String.fromCharCode(10))")
    assert.equal(invalidEmoji.result.value.success, false)

    const invalidEditedText = await cdp.evaluate("window.api.writeTextToClipboard('')")
    assert.equal(invalidEditedText.result.value.success, false)

    const paused = await cdp.evaluate('window.api.setMonitorPaused(true)')
    assert.equal(paused.result.value, true)
    // Database writes are deliberately debounced to batch rapid clipboard events.
    await new Promise((resolve) => setTimeout(resolve, 800))
  })

  await runElectron(9322, async (cdp) => {
    const restored = await cdp.evaluate('window.api.getMonitorPaused()')
    assert.equal(restored.result.value, true)
    const resumed = await cdp.evaluate('window.api.setMonitorPaused(false)')
    assert.equal(resumed.result.value, false)
  })

  console.log('Runtime smoke passed: Emoji UI, clipboard input validation, and pause persistence work across restart.')
} finally {
  await rm(profileDir, { recursive: true, force: true })
}
