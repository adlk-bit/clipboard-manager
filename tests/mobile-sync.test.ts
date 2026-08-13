import assert from 'node:assert/strict'
import test from 'node:test'
import { MobileSyncService } from '../electron/main/mobile-sync'
import { MOBILE_PAGE_HTML, MOBILE_PAGE_SCRIPT } from '../electron/main/mobile-page'
import {
  buildPairingUrl,
  isPrivateIpv4,
  isSixDigitCode,
  normalizeDeviceName,
} from '../shared/mobile-sync'

test('mobile sync validators accept only supported local values', () => {
  assert.equal(isSixDigitCode('123456'), true)
  assert.equal(isSixDigitCode('12345'), false)
  assert.equal(isSixDigitCode('1234567'), false)
  assert.equal(isSixDigitCode('１２３４５６'), false)
  assert.equal(normalizeDeviceName('  我的   iPhone  '), '我的 iPhone')
  assert.equal(normalizeDeviceName(''), 'iPhone')
  assert.equal(isPrivateIpv4('192.168.1.4'), true)
  assert.equal(isPrivateIpv4('172.31.8.2'), true)
  assert.equal(isPrivateIpv4('8.8.8.8'), false)
  assert.equal(buildPairingUrl('192.168.1.4', 37241, 'a+b'), 'http://192.168.1.4:37241/pair?token=a%2Bb')
})

test('the phone page keeps scripts external and ships parseable browser code', () => {
  assert.match(MOBILE_PAGE_HTML, /script src="\/phone\.js"/)
  assert.doesNotMatch(MOBILE_PAGE_HTML, /<script>(?!<\/script>)/)
  assert.doesNotThrow(() => new Function(MOBILE_PAGE_SCRIPT))
})

test('pairing issues a one-time device secret and authenticated requests sync text and OTP', async (t) => {
  const settings = new Map<string, string>()
  const writes: Array<{ text: string; source: 'clipboard' | 'otp'; deviceId: string }> = []
  let clipboardText = '电脑内容'
  const service = new MobileSyncService({
    getSetting: (key) => settings.get(key) || null,
    setSetting: (key, value) => settings.set(key, value),
    readClipboardText: () => clipboardText,
    writeClipboardText: (text, source, device) => {
      clipboardText = text
      writes.push({ text, source, deviceId: device.id })
      return true
    },
    getNetworkAddresses: () => [{ name: '测试网络', address: '127.0.0.1' }],
    getComputerName: () => 'Test-PC',
  })
  await service.start(0)
  t.after(async () => service.stop())

  const pairing = service.createPairing('127.0.0.1')
  const baseUrl = `http://127.0.0.1:${pairing.port}`
  const pairingToken = new URL(pairing.pairingUrl).searchParams.get('token')
  assert.ok(pairingToken)

  const pageResponse = await fetch(pairing.pairingUrl)
  assert.equal(pageResponse.status, 200)
  assert.match(await pageResponse.text(), /连接手机与电脑/)
  const scriptResponse = await fetch(`${baseUrl}/phone.js`)
  assert.equal(scriptResponse.status, 200)
  assert.match(scriptResponse.headers.get('content-type') || '', /javascript/)

  const pairResponse = await fetch(`${baseUrl}/api/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: pairingToken, name: '我的 iPhone' }),
  })
  assert.equal(pairResponse.status, 200)
  const credentials = await pairResponse.json() as { deviceId: string; deviceSecret: string }
  assert.ok(credentials.deviceId)
  assert.ok(credentials.deviceSecret)
  assert.equal(service.getStatus().devices[0]?.platform, 'iphone')
  assert.equal(settings.get('mobile_sync_devices_v1')?.includes(credentials.deviceSecret), false)

  const reusedPairResponse = await fetch(`${baseUrl}/api/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: pairingToken, name: '第二台设备' }),
  })
  assert.equal(reusedPairResponse.status, 403)

  const authHeaders = {
    Authorization: `Bearer ${credentials.deviceSecret}`,
    'X-Device-Id': credentials.deviceId,
  }
  const stateResponse = await fetch(`${baseUrl}/api/state`, { headers: authHeaders })
  assert.equal(stateResponse.status, 200)
  assert.deepEqual(await stateResponse.json(), { computerName: 'Test-PC', text: '电脑内容' })

  const clipboardResponse = await fetch(`${baseUrl}/api/clipboard`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '来自手机' }),
  })
  assert.equal(clipboardResponse.status, 200)
  assert.equal(writes.at(-1)?.source, 'clipboard')
  assert.equal(writes.at(-1)?.text, '来自手机')

  const otpUrl = `${baseUrl}/api/shortcut/otp?device=${encodeURIComponent(credentials.deviceId)}&key=${encodeURIComponent(credentials.deviceSecret)}&code=654321`
  const otpResponse = await fetch(otpUrl)
  assert.equal(otpResponse.status, 200)
  assert.equal(writes.at(-1)?.source, 'otp')
  assert.equal(writes.at(-1)?.text, '654321')

  const invalidOtpResponse = await fetch(otpUrl.replace('654321', '12345'))
  assert.equal(invalidOtpResponse.status, 400)
  assert.equal(service.setOtpEnabled(credentials.deviceId, false), true)
  assert.equal((await fetch(otpUrl)).status, 403)

  assert.equal(service.removeDevice(credentials.deviceId), true)
  assert.equal((await fetch(`${baseUrl}/api/state`, { headers: authHeaders })).status, 401)
})

test('authenticated Android OTP endpoint keeps device secrets out of URLs', async (t) => {
  const writes: Array<{ text: string; source: 'clipboard' | 'otp' }> = []
  const service = new MobileSyncService({
    getSetting: () => null,
    setSetting: () => undefined,
    readClipboardText: () => '',
    writeClipboardText: (text, source) => { writes.push({ text, source }); return true },
    getNetworkAddresses: () => [{ name: '测试网络', address: '127.0.0.1' }],
  })
  await service.start(0)
  t.after(async () => service.stop())
  const pairing = service.createPairing('127.0.0.1')
  const token = new URL(pairing.pairingUrl).searchParams.get('token')
  const pairResponse = await fetch(`http://127.0.0.1:${pairing.port}/api/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform: 'android', name: 'Android' }),
  })
  const credentials = await pairResponse.json() as { deviceId: string; deviceSecret: string }
  const endpoint = `http://127.0.0.1:${pairing.port}/api/otp`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.deviceSecret}`,
      'X-Device-Id': credentials.deviceId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code: '246810' }),
  })
  assert.equal(response.status, 200)
  assert.deepEqual(writes.at(-1), { text: '246810', source: 'otp' })
  assert.equal(endpoint.includes(credentials.deviceSecret), false)
  assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: '246810' }) })).status, 401)
})

test('Android pairing records the platform and can revoke itself', async (t) => {
  const service = new MobileSyncService({
    getSetting: () => null,
    setSetting: () => undefined,
    readClipboardText: () => '',
    writeClipboardText: () => true,
    getNetworkAddresses: () => [{ name: '测试网络', address: '127.0.0.1' }],
  })
  await service.start(0)
  t.after(async () => service.stop())
  const pairing = service.createPairing('127.0.0.1')
  const token = new URL(pairing.pairingUrl).searchParams.get('token')
  const response = await fetch(`http://127.0.0.1:${pairing.port}/api/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, name: 'Pixel', platform: 'android' }),
  })
  const credentials = await response.json() as { deviceId: string; deviceSecret: string }
  assert.equal(service.getStatus().devices[0]?.platform, 'android')
  const revokeResponse = await fetch(`http://127.0.0.1:${pairing.port}/api/device`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${credentials.deviceSecret}`, 'X-Device-Id': credentials.deviceId },
  })
  assert.equal(revokeResponse.status, 200)
  assert.equal(service.getStatus().devices.length, 0)
})

test('mobile sync rejects cross-origin browser API calls', async (t) => {
  const service = new MobileSyncService({
    getSetting: () => null,
    setSetting: () => undefined,
    readClipboardText: () => '',
    writeClipboardText: () => true,
    getNetworkAddresses: () => [{ name: '测试网络', address: '127.0.0.1' }],
  })
  await service.start(0)
  t.after(async () => service.stop())
  const port = service.getStatus().port
  assert.ok(port)
  const response = await fetch(`http://127.0.0.1:${port}/api/state`, { headers: { Origin: 'https://attacker.example' } })
  assert.equal(response.status, 403)
})
