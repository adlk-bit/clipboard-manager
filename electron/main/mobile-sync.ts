import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { networkInterfaces, hostname } from 'os'
import {
  buildPairingUrl,
  DEVICE_ONLINE_WINDOW_MS,
  isPrivateIpv4,
  isSixDigitCode,
  isValidDeviceId,
  MAX_SYNC_TEXT_LENGTH,
  MOBILE_SYNC_PORT,
  normalizeDeviceName,
  normalizeMobilePlatform,
  PAIRING_TTL_MS,
  type MobileSyncStatus,
  type NetworkAddress,
  type PairedDevice,
  type PairingInfo,
} from '../../shared/mobile-sync'
import { MOBILE_PAGE_HTML, MOBILE_PAGE_SCRIPT } from './mobile-page'

const DEVICES_SETTING_KEY = 'mobile_sync_devices_v1'
const MAX_REQUEST_BYTES = 16 * 1024
const TOUCH_PERSIST_INTERVAL_MS = 30 * 1000

interface StoredDevice {
  id: string
  name: string
  platform: 'iphone' | 'android'
  tokenHash: string
  pairedAt: string
  lastSeenAt: string
  otpEnabled: boolean
}

interface PairingSession {
  token: string
  expiresAt: number
  address: string
}

export interface MobileSyncDependencies {
  getSetting: (key: string) => string | null
  setSetting: (key: string, value: string) => void
  readClipboardText: () => string
  writeClipboardText: (text: string, source: 'clipboard' | 'otp', device: PairedDevice) => boolean
  onDevicesChanged?: () => void
  getNetworkAddresses?: () => NetworkAddress[]
  getComputerName?: () => string
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function tokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function isStoredDevice(value: unknown): value is StoredDevice {
  if (!value || typeof value !== 'object') return false
  const device = value as Partial<StoredDevice>
  return isValidDeviceId(device.id)
    && typeof device.name === 'string'
    && (device.platform === 'iphone' || device.platform === 'android')
    && typeof device.tokenHash === 'string'
    && /^[a-f0-9]{64}$/i.test(device.tokenHash)
    && typeof device.pairedAt === 'string'
    && typeof device.lastSeenAt === 'string'
    && typeof device.otpEnabled === 'boolean'
}

function adapterScore(name: string): number {
  const normalized = name.toLowerCase()
  if (/(vethernet|virtual|wsl|hyper-v|vmware|virtualbox|tailscale|vpn|loopback)/.test(normalized)) return -10
  if (/(wi-fi|wifi|wlan|wireless)/.test(normalized)) return 20
  if (/(ethernet|以太网)/.test(normalized)) return 10
  return 0
}

export function getLocalNetworkAddresses(): NetworkAddress[] {
  const addresses: Array<NetworkAddress & { score: number }> = []
  for (const [name, entries] of Object.entries(networkInterfaces())) {
    for (const entry of entries || []) {
      const isIpv4 = entry.family === 'IPv4' || (entry.family as unknown) === 4
      if (!isIpv4 || entry.internal || !isPrivateIpv4(entry.address)) continue
      addresses.push({ name, address: entry.address, score: adapterScore(name) })
    }
  }
  return addresses
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.address.localeCompare(b.address))
    .map(({ name, address }) => ({ name, address }))
}

function sendJson(response: ServerResponse, status: number, data: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(data))
}

function sendText(response: ServerResponse, status: number, contentType: string, data: string): void {
  response.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  })
  response.end(data)
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_REQUEST_BYTES) {
        reject(new Error('Request body is too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    request.on('error', reject)
  })
}

export class MobileSyncService {
  private server: Server | null = null
  private port: number | null = null
  private error: string | undefined
  private devices: StoredDevice[] = []
  private pairing: PairingSession | null = null
  private lastPersistedTouch = new Map<string, number>()

  constructor(private readonly dependencies: MobileSyncDependencies) {
    this.devices = this.loadDevices()
  }

  async start(preferredPort: number = MOBILE_SYNC_PORT): Promise<void> {
    if (this.server) return
    this.error = undefined
    try {
      await this.listen(preferredPort)
    } catch (firstError) {
      if ((firstError as NodeJS.ErrnoException).code !== 'EADDRINUSE') {
        this.error = String(firstError)
        return
      }
      try {
        await this.listen(0)
      } catch (secondError) {
        this.error = String(secondError)
      }
    }
  }

  async stop(): Promise<void> {
    this.persistDevices()
    const activeServer = this.server
    this.server = null
    this.port = null
    if (!activeServer) return
    await new Promise<void>((resolve) => activeServer.close(() => resolve()))
  }

  getStatus(now: number = Date.now()): MobileSyncStatus {
    return {
      running: this.server !== null && this.port !== null,
      port: this.port,
      addresses: this.getNetworkAddresses(),
      devices: this.devices.map((device) => this.toPublicDevice(device, now)),
      ...(this.error ? { error: this.error } : {}),
    }
  }

  createPairing(address?: string): PairingInfo {
    if (!this.server || this.port === null) throw new Error(this.error || '手机连接服务尚未启动')
    const addresses = this.getNetworkAddresses()
    const selected = address ? addresses.find((candidate) => candidate.address === address) : addresses[0]
    if (!selected) throw new Error('没有可用的局域网地址，请先让电脑连接 Wi-Fi 或有线网络')

    const token = randomBytes(32).toString('base64url')
    const expiresAt = Date.now() + PAIRING_TTL_MS
    this.pairing = { token, expiresAt, address: selected.address }
    return {
      pairingUrl: buildPairingUrl(selected.address, this.port, token),
      address: selected.address,
      port: this.port,
      expiresAt: new Date(expiresAt).toISOString(),
    }
  }

  removeDevice(id: string): boolean {
    if (!isValidDeviceId(id)) return false
    const previousLength = this.devices.length
    this.devices = this.devices.filter((device) => device.id !== id)
    this.lastPersistedTouch.delete(id)
    if (this.devices.length === previousLength) return false
    this.persistDevices()
    this.dependencies.onDevicesChanged?.()
    return true
  }

  setOtpEnabled(id: string, enabled: boolean): boolean {
    if (!isValidDeviceId(id)) return false
    const device = this.devices.find((candidate) => candidate.id === id)
    if (!device) return false
    device.otpEnabled = enabled
    this.persistDevices()
    this.dependencies.onDevicesChanged?.()
    return true
  }

  private listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer((request, response) => {
        void this.handleRequest(request, response).catch((requestError) => {
          console.error('Mobile sync request failed:', requestError)
          if (!response.headersSent) sendJson(response, 500, { error: 'Internal server error' })
          else response.end()
        })
      })
      server.requestTimeout = 10_000
      server.headersTimeout = 10_000
      server.keepAliveTimeout = 5_000
      const onError = (listenError: Error) => {
        server.removeAllListeners()
        reject(listenError)
      }
      server.once('error', onError)
      server.listen(port, '0.0.0.0', () => {
        server.off('error', onError)
        server.on('error', (runtimeError) => {
          console.error('Mobile sync server error:', runtimeError)
          this.error = String(runtimeError)
        })
        const address = server.address()
        this.server = server
        this.port = address && typeof address === 'object' ? address.port : port
        resolve()
      })
    })
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method || 'GET'
    const url = new URL(request.url || '/', 'http://localhost')

    if (method === 'GET' && (url.pathname === '/' || url.pathname === '/phone' || url.pathname === '/pair')) {
      sendText(response, 200, 'text/html; charset=utf-8', MOBILE_PAGE_HTML)
      return
    }
    if (method === 'GET' && url.pathname === '/phone.js') {
      sendText(response, 200, 'application/javascript; charset=utf-8', MOBILE_PAGE_SCRIPT)
      return
    }

    if (!this.isAllowedOrigin(request)) {
      sendJson(response, 403, { error: 'Origin is not allowed' })
      return
    }

    if (method === 'POST' && url.pathname === '/api/pair') {
      await this.handlePair(request, response)
      return
    }
    if (method === 'GET' && url.pathname === '/api/state') {
      const device = this.authenticate(request)
      if (!device) return sendJson(response, 401, { error: 'Device is not paired' })
      this.touch(device)
      sendJson(response, 200, {
        computerName: this.dependencies.getComputerName?.() || hostname(),
        text: this.dependencies.readClipboardText().slice(0, MAX_SYNC_TEXT_LENGTH),
      })
      return
    }
    if (method === 'POST' && url.pathname === '/api/clipboard') {
      const device = this.authenticate(request)
      if (!device) return sendJson(response, 401, { error: 'Device is not paired' })
      const body = await readJsonBody(request) as { text?: unknown }
      if (typeof body.text !== 'string' || body.text.length < 1 || body.text.length > MAX_SYNC_TEXT_LENGTH) {
        return sendJson(response, 400, { error: 'Text must contain between 1 and 10000 characters' })
      }
      this.touch(device)
      const success = this.dependencies.writeClipboardText(body.text, 'clipboard', this.toPublicDevice(device))
      sendJson(response, success ? 200 : 500, success ? { success: true } : { error: 'Clipboard write failed' })
      return
    }
    if (method === 'POST' && url.pathname === '/api/otp') {
      const device = this.authenticate(request)
      if (!device) return sendJson(response, 401, { error: 'Device is not paired' })
      if (!device.otpEnabled) return sendJson(response, 403, { error: 'Verification code sync is disabled for this device' })
      const body = await readJsonBody(request) as { code?: unknown }
      if (!isSixDigitCode(body.code)) return sendJson(response, 400, { error: 'A six-digit code is required' })
      this.touch(device)
      const success = this.dependencies.writeClipboardText(body.code, 'otp', this.toPublicDevice(device))
      sendJson(response, success ? 200 : 500, success ? { success: true } : { error: 'Clipboard write failed' })
      return
    }
    if (method === 'GET' && url.pathname === '/api/shortcut/otp') {
      const device = this.authenticateShortcut(url)
      if (!device) return sendJson(response, 401, { error: 'Device is not paired' })
      if (!device.otpEnabled) return sendJson(response, 403, { error: 'Verification code sync is disabled for this device' })
      const code = url.searchParams.get('code')
      if (!isSixDigitCode(code)) return sendJson(response, 400, { error: 'A six-digit code is required' })
      this.touch(device)
      const success = this.dependencies.writeClipboardText(code, 'otp', this.toPublicDevice(device))
      sendJson(response, success ? 200 : 500, success ? { success: true } : { error: 'Clipboard write failed' })
      return
    }
    if (method === 'DELETE' && url.pathname === '/api/device') {
      const device = this.authenticate(request)
      if (!device) return sendJson(response, 401, { error: 'Device is not paired' })
      sendJson(response, 200, { success: true })
      this.removeDevice(device.id)
      return
    }

    sendJson(response, 404, { error: 'Not found' })
  }

  private async handlePair(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = await readJsonBody(request) as { token?: unknown; name?: unknown; platform?: unknown }
    const token = typeof body.token === 'string' ? body.token : ''
    const pairing = this.pairing
    if (!pairing || pairing.expiresAt <= Date.now() || !tokenMatches(token, hashToken(pairing.token))) {
      return sendJson(response, 403, { error: '二维码已过期或已使用，请在电脑端重新生成' })
    }

    const deviceSecret = randomBytes(32).toString('base64url')
    const timestamp = new Date().toISOString()
    const device: StoredDevice = {
      id: randomUUID(),
      name: normalizeDeviceName(body.name),
      platform: normalizeMobilePlatform(body.platform),
      tokenHash: hashToken(deviceSecret),
      pairedAt: timestamp,
      lastSeenAt: timestamp,
      otpEnabled: true,
    }
    this.pairing = null
    this.devices.push(device)
    this.persistDevices()
    this.dependencies.onDevicesChanged?.()
    sendJson(response, 200, { deviceId: device.id, deviceSecret })
  }

  private authenticate(request: IncomingMessage): StoredDevice | null {
    const id = request.headers['x-device-id']
    const authorization = request.headers.authorization
    if (typeof id !== 'string' || !isValidDeviceId(id) || !authorization?.startsWith('Bearer ')) return null
    return this.findAuthenticatedDevice(id, authorization.slice(7))
  }

  private authenticateShortcut(url: URL): StoredDevice | null {
    const id = url.searchParams.get('device')
    const token = url.searchParams.get('key')
    if (!id || !token || !isValidDeviceId(id)) return null
    return this.findAuthenticatedDevice(id, token)
  }

  private findAuthenticatedDevice(id: string, token: string): StoredDevice | null {
    const device = this.devices.find((candidate) => candidate.id === id)
    return device && tokenMatches(token, device.tokenHash) ? device : null
  }

  private isAllowedOrigin(request: IncomingMessage): boolean {
    const origin = request.headers.origin
    if (!origin) return true
    const host = request.headers.host
    return typeof host === 'string' && origin === `http://${host}`
  }

  private touch(device: StoredDevice): void {
    const now = Date.now()
    const previousSeenAt = Date.parse(device.lastSeenAt) || 0
    device.lastSeenAt = new Date(now).toISOString()
    const lastPersisted = this.lastPersistedTouch.get(device.id) || 0
    if (now - lastPersisted >= TOUCH_PERSIST_INTERVAL_MS) {
      this.lastPersistedTouch.set(device.id, now)
      this.persistDevices()
      this.dependencies.onDevicesChanged?.()
    } else if (now - previousSeenAt > DEVICE_ONLINE_WINDOW_MS) {
      this.dependencies.onDevicesChanged?.()
    }
  }

  private toPublicDevice(device: StoredDevice, now: number = Date.now()): PairedDevice {
    const lastSeen = Date.parse(device.lastSeenAt)
    return {
      id: device.id,
      name: device.name,
      platform: device.platform,
      pairedAt: device.pairedAt,
      lastSeenAt: device.lastSeenAt,
      otpEnabled: device.otpEnabled,
      online: Number.isFinite(lastSeen) && now - lastSeen <= DEVICE_ONLINE_WINDOW_MS,
    }
  }

  private loadDevices(): StoredDevice[] {
    try {
      const parsed: unknown = JSON.parse(this.dependencies.getSetting(DEVICES_SETTING_KEY) || '[]')
      return Array.isArray(parsed) ? parsed.filter(isStoredDevice).slice(0, 50) : []
    } catch {
      return []
    }
  }

  private getNetworkAddresses(): NetworkAddress[] {
    return this.dependencies.getNetworkAddresses?.() || getLocalNetworkAddresses()
  }

  private persistDevices(): void {
    this.dependencies.setSetting(DEVICES_SETTING_KEY, JSON.stringify(this.devices))
  }
}

let activeService: MobileSyncService | null = null

export function setMobileSyncService(service: MobileSyncService | null): void {
  activeService = service
}

export function getMobileSyncService(): MobileSyncService | null {
  return activeService
}
