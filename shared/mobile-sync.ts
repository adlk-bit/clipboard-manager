export const MOBILE_SYNC_PORT = 37241
export const PAIRING_TTL_MS = 5 * 60 * 1000
export const DEVICE_ONLINE_WINDOW_MS = 8 * 1000
export const MAX_SYNC_TEXT_LENGTH = 10_000

export interface NetworkAddress {
  name: string
  address: string
}

export interface PairedDevice {
  id: string
  name: string
  platform: MobilePlatform
  pairedAt: string
  lastSeenAt: string
  otpEnabled: boolean
  online: boolean
}

export type MobilePlatform = 'iphone' | 'android'

export interface MobileSyncStatus {
  running: boolean
  port: number | null
  addresses: NetworkAddress[]
  devices: PairedDevice[]
  error?: string
}

export interface PairingInfo {
  pairingUrl: string
  address: string
  port: number
  expiresAt: string
}

export function isSixDigitCode(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9]{6}$/.test(value)
}

export function normalizeDeviceName(value: unknown): string {
  if (typeof value !== 'string') return 'iPhone'
  const compact = value.trim().replace(/\s+/g, ' ')
  return compact.slice(0, 40) || 'iPhone'
}

export function normalizeMobilePlatform(value: unknown): MobilePlatform {
  return value === 'android' ? 'android' : 'iphone'
}

export function isValidDeviceId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9-]{16,64}$/i.test(value)
}

export function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number)
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 169 && octets[1] === 254)
}

export function buildPairingUrl(address: string, port: number, token: string): string {
  return `http://${address}:${port}/pair?token=${encodeURIComponent(token)}`
}
