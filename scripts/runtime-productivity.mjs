import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const output = path.join(root, 'artifacts', 'productivity')
const pause = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms))
async function evaluate(cdp, expression) {
  const result = await cdp.evaluate(expression)
  assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails))
  return result.result?.value
}
let fixtureBuilt = false
async function fixture() {
  await mkdir(output, { recursive: true })
  const exe = path.join(output, 'NativeFixture.exe')
  if (!fixtureBuilt) {
  const build = spawnSync(path.join(process.env.SystemRoot, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'), ['/nologo', '/target:exe', '/platform:x64', '/r:System.Windows.Forms.dll', '/r:System.Drawing.dll', '/r:System.Web.Extensions.dll', `/out:${exe}`, path.join(root, 'tests', 'NativeFixture.cs')], { windowsHide: true, encoding: 'utf8' })
  assert.equal(build.status, 0, build.stdout + build.stderr)
  fixtureBuilt = true
  }
  const child = spawn(exe, [], { windowsHide: true, stdio: 'pipe' })
  let pending
  const next = () => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Fixture timed out')), 5000)
    pending = (value) => { clearTimeout(timeout); if (value.error) reject(new Error(value.error)); else resolve(value) }
  })
  createInterface({ input: child.stdout }).on('line', (line) => pending?.(JSON.parse(line)))
  const ready = await next(); assert.equal(ready.ready, true)
  return { async command(request) { const result = next(); child.stdin.write(JSON.stringify(request) + '\n'); return result }, close() { child.kill() } }
}
async function screenshot(cdp, name) { const image = await cdp.captureScreenshot(); await writeFile(path.join(output, name + '.png'), Buffer.from(image.data, 'base64')) }
async function click(cdp, text) {
  await evaluate(cdp, `(() => { const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent.trim() === ${JSON.stringify(text)}); if (!button) throw new Error('Missing button: ' + ${JSON.stringify(text)}); button.click() })()`)
  await pause()
}
export async function runProductivitySmoke(cdp) {
  assert.ok(cdp.verifyClipboard && cdp.mainEvaluate, 'Run with RUNTIME_COPY_TESTS=1; unsupported clipboard formats must be preserved')
  const target = await fixture()
  try {
    assert.equal((await evaluate(cdp, 'window.api.getCaptureStatus()')).native, true)
    await evaluate(cdp, "window.api.setWindowAlwaysOnTop(false)")
    if (process.env.RUNTIME_QUEUE_ONLY !== '1') {
    const template = await evaluate(cdp, "window.api.saveTemplate(null, '测试回复', '{{姓名}}，日期 {{日期}}')")
    await evaluate(cdp, `window.api.copyTemplate(${template.id}, {'姓名':'测试用户','日期':'2026-09-06'})`)
    await cdp.verifyClipboard('测试用户，日期 2026-09-06')
    await evaluate(cdp, `document.querySelector('button[aria-label="常用短语"]').click()`); await pause()
    await click(cdp, '使用')
    assert.equal(await evaluate(cdp, "!!document.querySelector('[role=dialog] input')"), true)
    await screenshot(cdp, 'template-variables-zh')
    await click(cdp, '关闭')
    await click(cdp, '新建')
    await evaluate(cdp, `(() => {
      const set = (selector, value, type) => { const node = document.querySelector(selector); Object.getOwnPropertyDescriptor(type.prototype, 'value').set.call(node, value); node.dispatchEvent(new Event('input', {bubbles:true})) }
      set('input[aria-label="模板标题"]', 'UI template', HTMLInputElement)
      set('textarea[aria-label="模板正文"]', 'Hello {{name}}', HTMLTextAreaElement)
    })()`)
    await click(cdp, '保存模板')
    assert.equal((await evaluate(cdp, 'window.api.getTemplates()')).length, 2)

    await evaluate(cdp, `window.api.setExcludedApps(['NativeFixture.exe'])`); await pause()
    await target.command({ action: 'copy', text: 'excluded-synthetic-4931' }); await cdp.verifyClipboard('excluded-synthetic-4931'); await pause(300)
    assert.equal((await evaluate(cdp, "window.api.getHistory('excluded-synthetic-4931')")).length, 0)
    await evaluate(cdp, 'window.api.setExcludedApps([])'); await pause()
    assert.equal((await evaluate(cdp, "window.api.getHistory('excluded-synthetic-4931')")).length, 0, 'Removing an exclusion must not capture the old clipboard')
    await target.command({ action: 'copy', text: 'source-synthetic-4931' }); await cdp.verifyClipboard('source-synthetic-4931'); await pause(350)
    const source = await evaluate(cdp, "window.api.getHistory('source-synthetic-4931', 'all', '', 'recent', 'all', 'nativefixture.exe')")
    assert.equal(source.length, 1); assert.equal(source[0].source_app, 'nativefixture.exe')
    await evaluate(cdp, 'window.api.setMonitorPaused(true)'); await pause()
    await target.command({ action: 'copy', text: 'paused-synthetic-4931' }); await cdp.verifyClipboard('paused-synthetic-4931'); await pause(200)
    await evaluate(cdp, 'window.api.setMonitorPaused(false)'); await pause(250)
    assert.equal((await evaluate(cdp, "window.api.getHistory('paused-synthetic-4931')")).length, 0)
    const imagePath = path.join(cdp.profileDir, 'images', 'fixture.png')
    await target.command({ action: 'image', path: imagePath, copy: true }); await cdp.verifyImageClipboard(imagePath); await pause(600)
    await cdp.mainEvaluate('globalThis.__captureCpuStart = process.cpuUsage()')
    const before = await evaluate(cdp, 'window.api.getCaptureStatus()'); await pause(4300)
    const after = await evaluate(cdp, 'window.api.getCaptureStatus()')
    assert.equal(after.imageEncodes, before.imageEncodes, 'Unchanged large image must not be re-encoded')
    const cpu = await cdp.mainEvaluate('(() => { const usage = process.cpuUsage(globalThis.__captureCpuStart); delete globalThis.__captureCpuStart; return (usage.user + usage.system) / 1000 })()')
    await writeFile(path.join(output, 'capture-metrics.json'), JSON.stringify({ durationMs: 4300, width: 1800, height: 1000, extraEncodes: after.imageEncodes - before.imageEncodes, mainCpuMs: cpu.result.value }, null, 2))
    console.log(`Idle image check passed: ${after.imageEncodes - before.imageEncodes} extra encodes in 4.3 seconds (1800 x 1000 fixture).`)
    await target.command({ action: 'copy', text: 'source-synthetic-4931' }); await cdp.verifyClipboard('source-synthetic-4931'); await pause(350)
    assert.ok((await evaluate(cdp, "window.api.getHistory('source-synthetic-4931')"))[0].use_count > source[0].use_count, 'Text -> image -> same text counts as a new acquisition')

    const ocrStatus = await evaluate(cdp, 'window.api.getOcrStatus()'); assert.equal(ocrStatus.available, true)
    const language = ocrStatus.languages.some((item) => item.tag === 'zh-Hans-CN') ? 'zh-Hans-CN' : 'en-US'
    const recognized = await evaluate(cdp, `window.api.recognizeImage(6, ${JSON.stringify(language)}, true)`)
    assert.match(recognized.text, /2048/)
    if (language === 'zh-Hans-CN') assert.match(recognized.text.replace(/\s/g, ''), /本地文字.*测试/)
    assert.equal((await evaluate(cdp, `window.api.recognizeImage(6, ${JSON.stringify(language)})`)).cached, true)
    assert.ok((await evaluate(cdp, "window.api.getHistory('2048', 'all', '', 'recent', 'image')")).some((item) => item.id === 6))
    await evaluate(cdp, `document.querySelector('button[aria-label="全部记录"]').click()`); await pause()
    await evaluate(cdp, `Array.from(document.querySelectorAll('[data-history-id="6"] button')).find(button => button.textContent.trim() === 'OCR').click()`); await pause(1000)
    assert.match(await evaluate(cdp, `document.querySelector('textarea[aria-label="识别结果"]').value`), /2048/)
    await screenshot(cdp, 'ocr-zh')
    const copyText = await evaluate(cdp, `document.querySelector('textarea[aria-label="识别结果"]').value`)
    await click(cdp, '复制文字'); await cdp.verifyClipboard(copyText)
    await evaluate(cdp, 'window.api.clearOcr(6)')
    assert.equal((await evaluate(cdp, "window.api.getHistory('2048', 'all', '', 'recent', 'image')")).length, 0)
    await evaluate(cdp, `window.api.recognizeImage(6, ${JSON.stringify(language)}, true)`)

    }
    await evaluate(cdp, 'window.api.startQueue([2, 3, 5])')
    await screenshot(cdp, 'queue-zh')
    if (process.env.RUNTIME_SKIP_NATIVE_INPUT !== '1') {
    await evaluate(cdp, 'window.api.hideWindow()')
    await target.command({ action: 'focus' }); await pause(250)
    await target.command({ action: 'shortcut' }); await pause(450)
    let queue = await evaluate(cdp, 'window.api.getQueueStatus()')
    assert.equal(queue.target, 'nativefixture.exe', 'Only the synthetic test window may receive input');
    assert.equal(queue.cursor, 1, JSON.stringify(queue)); await cdp.verifyClipboard('Alpha\n\nBeta\nAlpha')
    const received = await target.command({ action: 'read' })
    assert.equal(received.text.replace(/\r/g, ''), 'Alpha\n\nBeta\nAlpha', JSON.stringify(received))
    await evaluate(cdp, "window.api.controlQueue('pause')")
    await target.command({ action: 'shortcut' }); await pause(200)
    assert.equal((await evaluate(cdp, 'window.api.getQueueStatus()')).cursor, 1)
    await evaluate(cdp, "window.api.controlQueue('resume')")
    await target.command({ action: 'shortcut' }); await pause(400); await cdp.verifyClipboard('Gamma\nBeta')
    assert.equal((await target.command({ action: 'read' })).text.replace(/\r/g, ''), 'Alpha\n\nBeta\nAlphaGamma\nBeta')
    await evaluate(cdp, "window.api.controlQueue('skip')")
    assert.equal((await evaluate(cdp, 'window.api.getQueueStatus()')).cursor, 3)
    await evaluate(cdp, "window.api.controlQueue('back')")
    const second = await fixture()
    try {
      await second.command({ action: 'focus' }); await pause(250)
      await second.command({ action: 'shortcut' }); await pause(350)
      queue = await evaluate(cdp, 'window.api.getQueueStatus()'); assert.equal(queue.cursor, 2); assert.equal(queue.error, 'target-changed'); assert.equal(queue.paused, true)
      assert.equal((await second.command({ action: 'read' })).text, '')
      await evaluate(cdp, "window.api.controlQueue('retarget')")
      await second.command({ action: 'shortcut' }); await pause(350); await cdp.verifyClipboard('Budget 100% A_B')
      assert.equal((await second.command({ action: 'read' })).text, 'Budget 100% A_B')
      assert.equal((await evaluate(cdp, 'window.api.getQueueStatus()')).cursor, 3)
    } finally { second.close() }
    console.log('Native input passed: actual target text, order, pause, skip/back, changed-target rejection and explicit retarget.')
    } else console.log('Native input checks skipped: foreground is in use.')
    await evaluate(cdp, "window.api.controlQueue('stop')")
    if (process.env.RUNTIME_QUEUE_ONLY === '1') { console.log('Native queue checks passed.'); return }
    await evaluate(cdp, "window.api.setExcludedApps(['keepass.exe'])")
    await evaluate(cdp, 'window.api.setWindowAlwaysOnTop(true)')
    await cdp.mainEvaluate("process.getBuiltinModule('module').createRequire(process.cwd() + '/runtime.cjs')('electron').BrowserWindow.getAllWindows()[0].show()")
    await evaluate(cdp, `document.querySelector('button[aria-label="设置"]').click()`); await pause()
    await click(cdp, 'English'); await pause()
    await evaluate(cdp, `document.querySelector('button[aria-label="Phrases"]').click()`); await pause()
    await screenshot(cdp, 'phrases-en')
    await cdp.resizeWindow(320, 400); await pause(200)
    await screenshot(cdp, 'phrases-compact-en')
    assert.equal(await evaluate(cdp, 'document.documentElement.scrollWidth > window.innerWidth'), false)
    await cdp.resizeWindow(400, 600)
    await evaluate(cdp, `document.querySelector('button[aria-label="Settings"]').click()`); await pause()
    await evaluate(cdp, `document.querySelector('button[role="switch"]').click()`); await pause()
    await evaluate(cdp, `document.querySelector('input[aria-label="Excluded app"]').closest('section').scrollIntoView({block:'center'})`); await pause()
    await screenshot(cdp, 'settings-dark-en')
    const stoppedHelper = await cdp.mainEvaluate(`(() => {
      const helper = process._getActiveHandles().find(handle => typeof handle.spawnfile === 'string' && handle.spawnfile.endsWith('ClipboardBridge.exe'))
      if (!helper) return false
      return helper.kill()
    })()`)
    assert.equal(stoppedHelper.result.value, true)
    await pause(200)
    assert.equal((await evaluate(cdp, 'window.api.getCaptureStatus()')).native, false)
    await target.command({ action: 'copy', text: 'unknown-source-synthetic-4931' }); await cdp.verifyClipboard('unknown-source-synthetic-4931'); await pause(2300)
    assert.equal((await evaluate(cdp, "window.api.getHistory('unknown-source-synthetic-4931')")).length, 0, 'Helper failure plus exclusions must skip unknown sources')
    console.log('Capture fallback passed: unknown-source content was excluded after helper termination.')
    await pause(800)
    console.log('Productivity runtime passed: template UI/save/copy, Chinese & English OCR/search/clear/cache, source attribution/exclusion/pause, queue UI and compact layout (native input has a separate completion line).')
  } finally { target.close() }
}
export async function verifyProductivityRestart(cdp) {
  if (process.env.RUNTIME_QUEUE_ONLY === '1') return
  const values = await evaluate(cdp, `(async () => ({templates: await window.api.getTemplates(), exclusions: await window.api.getExcludedApps(), history: await window.api.getHistory('2048'), queue: await window.api.getQueueStatus(), topmost: await window.api.getWindowAlwaysOnTop()}))()`)
  assert.equal(values.templates.length, 2); assert.deepEqual(values.exclusions, ['keepass.exe']); assert.equal(values.queue.total, 0); assert.equal(values.topmost, true)
  assert.ok(values.history.some((item) => item.id === 6 && item.ocr_language))
  console.log('Productivity persistence passed: templates, OCR index, exclusions and native topmost restored; paste queue remains session-only.')
}
