export interface QuickPasteStatus { session: number; active: boolean; busy: boolean; target: string }
export interface QuickPasteResult { success: boolean; copied: boolean; error?: string }

/** One-use authorization tied to one hotkey invocation, never persisted. */
export class QuickPasteSession<T> {
  private revision = 0
  private active = false
  private target: T | null = null
  busy = false
  begin(): number | null {
    if (this.busy) return null
    this.target = null; this.active = true
    return ++this.revision
  }
  bind(session: number, target: T): boolean {
    if (!this.active || session !== this.revision || this.busy) return false
    this.target = target
    return true
  }
  cancel(): void { this.active = false; this.target = null; this.revision++ }
  status(label: (target: T) => string): QuickPasteStatus {
    return { session: this.revision, active: this.active, busy: this.busy, target: this.target ? label(this.target) : '' }
  }
  claim(session: number): { target: T | null } | null {
    if (!this.active || this.busy || session !== this.revision) return null
    const target = this.target
    this.active = false; this.target = null; this.busy = true
    return { target }
  }
  finish(): void { this.busy = false }
}
