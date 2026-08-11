import { getSetting, deleteExpiredHistory, cleanupStorageIntegrity } from './database'

let cleanupTimer: NodeJS.Timeout | null = null

function runCleanup(onHistoryChanged?: () => void): void {
  const retentionDays = parseInt(getSetting('retention_days') || '3', 10)
  const deleted = retentionDays > 0 ? deleteExpiredHistory(retentionDays) : 0
  const integrity = cleanupStorageIntegrity()
  if (deleted > 0 || integrity.missingHistoryRows > 0 || integrity.missingStickerRows > 0 || integrity.orphanFiles > 0) {
    console.log(`[Scheduler] Removed ${deleted} expired items and ${integrity.orphanFiles} orphaned files`)
    onHistoryChanged?.()
  }
}

export function startScheduler(onHistoryChanged?: () => void) {
  // Run cleanup every hour
  cleanupTimer = setInterval(() => runCleanup(onHistoryChanged), 60 * 60 * 1000)

  // Run once at startup
  runCleanup(onHistoryChanged)
}

export function stopScheduler() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}
