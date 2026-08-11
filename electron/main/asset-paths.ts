import { app } from 'electron'
import fs from 'fs'
import path from 'path'

function ensureDirectory(name: 'images' | 'stickers'): string {
  const directory = path.join(app.getPath('userData'), name)
  fs.mkdirSync(directory, { recursive: true })
  return directory
}

export function getHistoryImagesDir(): string {
  return ensureDirectory('images')
}

export function getStickersDir(): string {
  return ensureDirectory('stickers')
}

function normalizedPath(filePath: string): string {
  const resolved = path.resolve(filePath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

export function isPathInside(directory: string, filePath: string): boolean {
  const root = `${normalizedPath(directory)}${path.sep}`
  const target = normalizedPath(filePath)
  return target.startsWith(root)
}

export function isManagedAssetPath(filePath: string): boolean {
  return isPathInside(getHistoryImagesDir(), filePath) || isPathInside(getStickersDir(), filePath)
}
