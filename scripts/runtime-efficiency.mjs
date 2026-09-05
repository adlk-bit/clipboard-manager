import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

/** Exercise the shipped renderer and real preload/IPC using synthetic history. */
export async function runEfficiencySmoke(cdp) {
  const evaluate = async (expression) => {
    const result = await cdp.evaluate(expression)
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || 'Renderer assertion failed')
    return result.result.value
  }
  const frame = `await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`
  const settle = `await new Promise(resolve => setTimeout(resolve, 300))`
  const setInput = `(input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }`
  const setTextarea = `(input, value) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }`
  const button = `(label) => Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === label)`
  const snapshot = async (name) => {
    if (!process.env.RUNTIME_EFFICIENCY_SCREENSHOT_DIR) return
    const result = await cdp.captureScreenshot()
    await writeFile(`${process.env.RUNTIME_EFFICIENCY_SCREENSHOT_DIR}/${name}.png`, Buffer.from(result.data, 'base64'))
  }

  assert.deepEqual(await evaluate(`(async () => {
    document.querySelector('button[aria-label="All History"]').click()
    ${settle}
    const all = await window.api.getHistory()
    const links = await window.api.getHistory('', 'all', '', 'recent', 'url')
    const texts = await window.api.getHistory('', 'all', '', 'recent', 'text')
    const images = await window.api.getHistory('', 'all', '', 'recent', 'image')
    const multi = await window.api.getHistory('紧急 工作')
    const literal = await window.api.getHistory('%')
    return { total: all.length, links: links.map(item => item.id), texts: texts.map(item => item.id).sort(), images: images.map(item => item.id), multi: multi.map(item => item.id), literal: literal.map(item => item.id) }
  })()`), { total: 6, links: [4], texts: [1, 2, 3, 5], images: [6], multi: [1], literal: [5] })

  assert.deepEqual(await evaluate(`(async () => {
    ;(${button})('Links').click(); ${settle}
    const linkCards = document.querySelectorAll('.history-card').length
    ;(${button})('Text').click(); ${settle}
    const textCards = document.querySelectorAll('.history-card').length
    ;(${button})('All').click(); ${settle}
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }))
    const input = document.getElementById('history-search')
    const searchFocused = document.activeElement === input
    ;(${setInput})(input, 'Beta'); ${settle}
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    ${frame}
    const activeId = document.querySelector('[data-keyboard-active="true"]')?.getAttribute('data-history-id')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    ${settle}
    return { linkCards, textCards, searchFocused, activeId, cleared: input.value === '', restoredCount: document.querySelectorAll('.history-card').length }
  })()`), { linkCards: 1, textCards: 4, searchFocused: true, activeId: '3', cleared: true, restoredCount: 6 })
  await snapshot('history-light-en')

  assert.deepEqual(await evaluate(`(async () => {
    ;(${button})('Manage').click(); ${frame}
    document.querySelector('[data-history-id="2"] [role="checkbox"]').click(); ${frame}
    document.querySelector('[data-history-id="6"] [role="checkbox"]').click(); ${frame}
    const imagesRejected = (${button})('Merge & copy').disabled
    document.querySelector('[data-history-id="6"] [role="checkbox"]').click(); ${frame}
    document.querySelector('[data-history-id="3"] [role="checkbox"]').click(); ${frame}
    ;(${button})('Merge & copy').click(); ${frame}
    const textarea = document.querySelector('textarea')
    const initial = textarea.value
    const originalIds = Array.from(document.querySelectorAll('.history-card')).map(card => card.dataset.historyId)
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true }))
    ${frame}
    const modalRetained = Boolean(document.querySelector('[role="dialog"]'))
    const separator = document.getElementById('merge-separator')
    separator.value = 'comma'; separator.dispatchEvent(new Event('change', { bubbles: true })); ${frame}
    const separated = textarea.value
    document.querySelector('[role="dialog"] input[type="checkbox"]').click(); ${frame}
    return { imagesRejected, initial, separated, reversed: textarea.value, modalRetained, noBackgroundReorder: JSON.stringify(originalIds) === JSON.stringify(Array.from(document.querySelectorAll('.history-card')).map(card => card.dataset.historyId)) }
  })()`), {
    imagesRejected: true,
    initial: 'Gamma\nBeta\nAlpha\n\nBeta\nAlpha',
    separated: 'Gamma\nBeta, Alpha\n\nBeta\nAlpha',
    reversed: 'Alpha\n\nBeta\nAlpha, Gamma\nBeta',
    modalRetained: true, noBackgroundReorder: true,
  })
  await snapshot('merge-light-en')

  assert.deepEqual(await evaluate(`(async () => {
    const textarea = document.querySelector('textarea')
    const tools = document.querySelector('select[aria-label="Text tools"]')
    ;(${button})('Reset').click(); ${frame}
    tools.value = 'removeBlankLines'; tools.dispatchEvent(new Event('change', { bubbles: true })); ${frame}
    ;(${button})('Apply').click(); ${frame}
    tools.value = 'deduplicateLines'; tools.dispatchEvent(new Event('change', { bubbles: true })); ${frame}
    ;(${button})('Apply').click(); ${frame}
    const deduplicated = textarea.value
    ;(${button})('Undo').click(); ${frame}
    const undone = textarea.value
    ;(${setTextarea})(textarea, '{broken}'); ${frame}
    tools.value = 'formatJson'; tools.dispatchEvent(new Event('change', { bubbles: true })); ${frame}
    ;(${button})('Apply').click(); ${frame}
    const invalidPreserved = textarea.value === '{broken}' && document.querySelector('[role="status"]').textContent.includes('Invalid JSON')
    ;(${setTextarea})(textarea, 'x'.repeat(10001)); ${frame}
    const oversizedBlocked = (${button})('Copy merged text').disabled && textarea.value.length === 10001
    ;(${setTextarea})(textarea, '{"items":[1,2]}'); ${frame}
    ;(${button})('Apply').click(); ${frame}
    const jsonFormatted = textarea.value
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ${frame}
    const dismissed = !document.querySelector('[role="dialog"]')
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ${frame}
    return { deduplicated, undone, invalidPreserved, oversizedBlocked, jsonFormatted, dismissed, selectionExited: !document.querySelector('[role="checkbox"]') }
  })()`), {
    deduplicated: 'Gamma\nBeta\nAlpha', undone: 'Gamma\nBeta\nAlpha\nBeta\nAlpha',
    invalidPreserved: true, oversizedBlocked: true, jsonFormatted: '{\n  "items": [\n    1,\n    2\n  ]\n}', dismissed: true, selectionExited: true,
  })

  // Successful OS clipboard writes are opt-in and preserve supported prior formats in memory.
  assert.equal(await evaluate(`(async () => {
    const result = await window.api.writeTextToClipboard('x'.repeat(10001))
    return result.success === false
  })()`), true)

  assert.equal(await evaluate(`(async () => {
    document.querySelector('button[aria-label="Settings"]').click(); ${settle}
    document.querySelector('button[role="switch"]').click(); ${settle}
    document.querySelector('button[aria-label="All History"]').click(); ${settle}
    return document.documentElement.classList.contains('dark')
  })()`), true)
  await snapshot('history-dark-en')
  await evaluate(`(async () => {
    document.querySelector('[data-history-id="2"] button[aria-label="Edit before copying"]').click(); ${frame}
  })()`)
  await snapshot('tools-dark-en')
  await evaluate(`(async () => {
    document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ${frame}
    document.querySelector('button[aria-label="Settings"]').click(); ${settle}
    document.querySelector('button[role="switch"]').click(); ${settle}
  })()`)
  await evaluate(`(async () => {
    Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === '简体中文').click(); ${settle}
    document.querySelector('button[aria-label="全部记录"]').click(); ${settle}
  })()`)
  await snapshot('history-light-zh')
  await evaluate(`(async () => {
    ;(${button})('批量管理').click(); ${frame}
    document.querySelector('[data-history-id="2"] [role="checkbox"]').click(); ${frame}
    document.querySelector('[data-history-id="3"] [role="checkbox"]').click(); ${frame}
    ;(${button})('合并复制').click(); ${frame}
  })()`)
  await snapshot('merge-light-zh')
  if (cdp.resizeWindow) {
    await cdp.resizeWindow(320, 400)
    assert.equal(await evaluate(`(async () => {
      ${settle}
      const dialog = document.querySelector('[role="dialog"]')
      const bounds = dialog.getBoundingClientRect()
      const copyBounds = (${button})('复制合并内容').getBoundingClientRect()
      return bounds.top >= 0 && bounds.bottom <= window.innerHeight && bounds.right <= window.innerWidth && copyBounds.bottom <= bounds.bottom
    })()`), true)
    await snapshot('merge-minimum-zh')
    await cdp.resizeWindow(400, 600)
    await evaluate(`(async () => { ${settle} })()`)
  }
  if (cdp.verifyClipboard) {
    const before = await evaluate('window.api.getHistory()')
    assert.equal(await evaluate(`(async () => {
      const textarea = document.querySelector('textarea')
      ;(${setTextarea})(textarea, 'Clipboard efficiency smoke: merged text'); ${frame}
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }))
      ${settle}
      return !document.querySelector('[role="dialog"]')
    })()`), true)
    await cdp.verifyClipboard('Clipboard efficiency smoke: merged text')
    const after = await evaluate('window.api.getHistory()')
    assert.deepEqual(after.map(item => [item.id, item.content]), before.map(item => [item.id, item.content]))
    assert.equal(await evaluate(`(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ${frame}
      document.querySelector('[data-history-id="1"] button[aria-label="复制到剪贴板"]').click(); ${settle}
      return !document.body.textContent.includes('13812345678') && document.body.textContent.includes('内容已复制')
    })()`), true)
    await cdp.verifyClipboard('客户手机 13812345678')
    console.log('OS clipboard passed: merged copy, unchanged source records, and masked copy notifications.')
  } else {
    await evaluate(`(async () => {
      document.querySelector('textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ${frame}
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); ${frame}
    })()`)
  }
  await evaluate(`(async () => {
    document.querySelector('button[aria-label="设置"]').click(); ${settle}
    Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'English').click(); ${settle}
    document.querySelector('button[aria-label="All History"]').click(); ${settle}
  })()`)
  if (cdp.verifyClipboard) {
    await evaluate(`(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '3', ctrlKey: true, bubbles: true }))
      await new Promise(resolve => setTimeout(resolve, 200))
    })()`)
    await cdp.verifyClipboard('Budget 100% A_B')
    await cdp.verifyHiddenWindow()
    console.log('OS clipboard passed: Ctrl+3 copies the third visible record.')
  }
  console.log('Efficiency runtime passed: type filters, literal/multi-keyword search, keyboard navigation, merge order, image exclusion, text tools, undo, JSON errors, size limits, and modal guards.')
}
