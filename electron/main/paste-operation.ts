// Serialize all native paste operations, including the sequential queue.
let busy = false
export function acquirePaste(): boolean {
  if (busy) return false
  busy = true
  return true
}
export function releasePaste(): void { busy = false }
