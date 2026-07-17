import { getSetting, deleteExpiredHistory } from './database'

let cleanupTimer: NodeJS.Timeout | null = null

export function startScheduler() {
  // Run cleanup every hour
  cleanupTimer = setInterval(() => {
    const retentionDays = parseInt(getSetting('retention_days') || '3', 10)
    if (retentionDays > 0) {
      const deleted = deleteExpiredHistory(retentionDays)
      if (deleted > 0) {
        console.log(`[Scheduler] Cleaned up ${deleted} expired history items`)
      }
    }
  }, 60 * 60 * 1000) // every hour

  // Run once at startup
  const retentionDays = parseInt(getSetting('retention_days') || '3', 10)
  if (retentionDays > 0) {
    deleteExpiredHistory(retentionDays)
  }
}

export function stopScheduler() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}
