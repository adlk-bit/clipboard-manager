import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHotkey, getAcceleratorKey } from '../src/lib/hotkey'

test('hotkey recorder converts a modified key press to an Electron accelerator', () => {
  assert.equal(buildHotkey({ key: 'k', ctrlKey: true, altKey: true, shiftKey: false, metaKey: false }), 'Ctrl+Alt+K')
  assert.equal(buildHotkey({ key: 'ArrowUp', ctrlKey: false, altKey: false, shiftKey: true, metaKey: false }), 'Shift+Up')
})

test('hotkey recorder rejects bare and modifier-only key presses', () => {
  assert.equal(buildHotkey({ key: 'v', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false }), null)
  assert.equal(buildHotkey({ key: 'Control', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false }), null)
  assert.equal(getAcceleratorKey('F24'), 'F24')
  assert.equal(getAcceleratorKey('F25'), null)
})
