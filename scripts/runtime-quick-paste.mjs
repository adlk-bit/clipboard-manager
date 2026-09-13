import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fixture } from './runtime-productivity.mjs'

const pause = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))
async function evaluate(cdp, expression) {
  const result = await cdp.evaluate(expression)
  assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails))
  return result.result?.value
}
export async function runQuickPasteSmoke(cdp) {
  assert.ok(cdp.verifyClipboard && cdp.mainEvaluate, 'Requires RUNTIME_COPY_TESTS=1 and supported clipboard formats')
  const target = await fixture()
  const output = path.resolve('artifacts/quick-paste')
  await mkdir(output, { recursive: true })
  const state = () => evaluate(cdp, 'window.api.getQuickPasteStatus()')
  const key = async (key, extra = '') => {
    await evaluate(cdp, "document.getElementById('history-search').focus()")
    const result = await cdp.mainEvaluate(`(() => { const e = process.getBuiltinModule('module').createRequire(process.cwd() + '/runtime.cjs')('electron'); const b = e.BrowserWindow.getAllWindows()[0].getNativeWindowHandle(); return {handle: b.readBigUInt64LE().toString(), pid: process.pid} })()`)
    await target.command({ action: 'panel-key', ...result.result.value, key: key === 'Enter' ? 13 : key === 'Escape' ? 27 : 39, ctrl: extra.includes('ctrlKey') })
  }
  const select = (id) => evaluate(cdp, `document.querySelector('[data-history-id="${id}"] > div').click()`)
  const open = async () => {
    await target.command({ action: 'focus' })
    await pause(200)
    await target.command({ action: 'quick-shortcut' })
    const deadline = Date.now() + 4000
    while (!(await state()).active && Date.now() < deadline) await pause(80)
    const current = await state()
    assert.equal(current.active, true, JSON.stringify(current))
    assert.equal(current.target, 'nativefixture.exe')
    await pause(300)
    return current
  }
  try {
    assert.equal((await evaluate(cdp, "window.api.setHotkey('Ctrl+Shift+F11')")).success, true)
    await evaluate(cdp, 'window.api.setWindowAlwaysOnTop(false)')
    await open()
    assert.equal(await evaluate(cdp, 'document.activeElement.id'), 'history-search')
    await select(2)
    await pause()
    await writeFile(path.join(output, 'quick-paste-zh.png'), Buffer.from((await cdp.captureScreenshot()).data, 'base64'))
    await key('Enter')
    await pause(600)
    const pasted = await target.command({ action: 'read' })
    assert.equal(pasted.text.replaceAll('\r\n', '\n'), 'Alpha\n\nBeta\nAlpha', JSON.stringify({ target: pasted, ui: await evaluate(cdp, 'document.body.innerText') }))
    assert.equal(pasted.foreground, pasted.handle)
    assert.ok(!pasted.keys.some((value) => value === 'Return'), 'No confirmation Enter reaches the destination')
    await cdp.verifyClipboard('Alpha\n\nBeta\nAlpha')
    await cdp.verifyHiddenWindow()

    const copySession = await open()
    await select(3)
    await key('Enter', ', ctrlKey: true')
    await pause()
    await cdp.verifyClipboard('Gamma\nBeta')
    assert.equal((await target.command({ action: 'read' })).text, pasted.text, 'Ctrl+Enter only copies')
    await cdp.verifyHiddenWindow()
    assert.equal((await state()).active, false)

    await open()
    const stale = await evaluate(cdp, `window.api.quickPaste(2, ${copySession.session})`)
    assert.equal(stale.success, false)
    assert.equal(stale.copied, false)
    await key('Escape')
    await pause()
    assert.equal((await state()).active, false)
    await cdp.verifyHiddenWindow()

    await open()
    await target.command({ action: 'focus' })
    await pause()
    assert.equal((await state()).active, false, 'Switching away cancels the target')

    await open()
    await evaluate(cdp, 'window.api.setWindowAlwaysOnTop(true)')
    await select(5)
    await key('ArrowRight')
    await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find(b => b.textContent === '粘贴选中记录').click()`)
    await pause(600)
    assert.equal((await target.command({ action: 'read' })).text, pasted.text + 'Budget 100% A_B')
    await cdp.verifyClipboard('Budget 100% A_B')
    await cdp.verifyHiddenWindow()

    await open()
    await cdp.resizeWindow(320, 400)
    await evaluate(cdp, `document.querySelector('button[aria-label="设置"]').click()`)
    await pause()
    await evaluate(cdp, `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'English').click()`)
    await pause()
    await open()
    await writeFile(path.join(output, 'quick-paste-compact-en.png'), Buffer.from((await cdp.captureScreenshot()).data, 'base64'))
    assert.equal(await evaluate(cdp, 'document.documentElement.scrollWidth > window.innerWidth'), false)
    await select(6)
    await key('Enter')
    await pause()
    assert.ok((await evaluate(cdp, 'document.body.innerText')).includes('Images support copy only'))
    assert.equal((await state()).active, true)

    target.close()
    await pause()
    const closed = await evaluate(cdp, `(async () => window.api.quickPaste(3, (await window.api.getQuickPasteStatus()).session))()`)
    assert.equal(closed.success, false)
    assert.equal(closed.copied, true)
    assert.equal(closed.error, 'window-closed')
    await cdp.verifyClipboard('Gamma\nBeta')
    assert.equal((await state()).active, false)
    console.log('Quick paste runtime passed: real hotkey -> search focus -> Enter and mouse paste into synthetic native target, topmost, copy-only, Escape, focus loss, stale request rejection, text-only, closed-window fallback, bilingual compact layout.')
  } finally { target.close() }
}
