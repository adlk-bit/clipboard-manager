import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAutoLaunchStatus,
  setAutoLaunchEnabled,
  synchronizeAutoLaunch,
  type AutoLaunchApp,
  type LoginItemSettingsSnapshot,
} from '../electron/main/auto-launch'

function createApp(initial: LoginItemSettingsSnapshot, packaged = true) {
  let settings = { ...initial }
  const writes: Array<{ openAtLogin: boolean; path?: string; args?: string[] }> = []
  const app: AutoLaunchApp = {
    isPackaged: packaged,
    getPath: () => 'C:\\Program Files\\ClipboardManager\\ClipboardManager.exe',
    getLoginItemSettings: () => ({ ...settings }),
    setLoginItemSettings: (next) => {
      writes.push(next)
      settings = {
        openAtLogin: next.openAtLogin,
        executableWillLaunchAtLogin: next.openAtLogin,
      }
    },
  }
  return { app, writes, setSettings: (next: LoginItemSettingsSnapshot) => { settings = { ...next } } }
}

test('auto-launch is unavailable for an unpackaged development executable', () => {
  const { app, writes } = createApp({ openAtLogin: false }, false)
  assert.deepEqual(getAutoLaunchStatus(app, 'win32'), {
    supported: false,
    configured: false,
    enabled: false,
  })
  assert.equal(setAutoLaunchEnabled(app, true, 'win32').success, false)
  assert.equal(writes.length, 0)
})

test('auto-launch writes and verifies the packaged executable path', () => {
  const { app, writes } = createApp({ openAtLogin: false })
  const result = setAutoLaunchEnabled(app, true, 'win32')

  assert.equal(result.success, true)
  assert.equal(result.enabled, true)
  assert.deepEqual(writes, [{
    openAtLogin: true,
    path: 'C:\\Program Files\\ClipboardManager\\ClipboardManager.exe',
    args: [],
  }])
})

test('auto-launch reports failure when Windows does not apply the requested change', () => {
  const { app } = createApp({ openAtLogin: false })
  app.setLoginItemSettings = () => {}

  const result = setAutoLaunchEnabled(app, true, 'win32')
  assert.equal(result.success, false)
  assert.equal(result.enabled, false)
  assert.match(result.error || '', /did not apply/)
})

test('effective status reflects a login item disabled in Windows Startup Apps', () => {
  const { app } = createApp({ openAtLogin: true, executableWillLaunchAtLogin: false })
  assert.deepEqual(getAutoLaunchStatus(app, 'win32'), {
    supported: true,
    configured: true,
    enabled: false,
  })
})

test('first packaged run repairs older installations with no saved preference', () => {
  const { app, writes } = createApp({ openAtLogin: false })
  const result = synchronizeAutoLaunch(app, null, 'win32')

  assert.equal(result.success, true)
  assert.equal(result.enabled, true)
  assert.equal(writes.length, 1)
})

test('first packaged run preserves an existing login item disabled in Windows', () => {
  const { app, writes } = createApp({ openAtLogin: true, executableWillLaunchAtLogin: false })
  const result = synchronizeAutoLaunch(app, null, 'win32')

  assert.equal(result.success, true)
  assert.equal(result.enabled, false)
  assert.equal(writes.length, 0)
})

test('startup synchronization respects a login item disabled by the user in Windows', () => {
  const { app, writes } = createApp({ openAtLogin: true, executableWillLaunchAtLogin: false })
  const result = synchronizeAutoLaunch(app, 'true', 'win32')

  assert.equal(result.success, true)
  assert.equal(result.enabled, false)
  assert.equal(writes.length, 0)
})

test('disabling auto-launch removes a stale configured login item', () => {
  const { app, writes } = createApp({ openAtLogin: true, executableWillLaunchAtLogin: true })
  const result = synchronizeAutoLaunch(app, 'false', 'win32')

  assert.equal(result.success, true)
  assert.equal(result.configured, false)
  assert.equal(writes.length, 1)
  assert.equal(writes[0].openAtLogin, false)
})
