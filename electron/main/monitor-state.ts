export class MonitorPauseState {
  private paused = false

  isPaused(): boolean {
    return this.paused
  }

  canPoll(): boolean {
    return !this.paused
  }

  setPaused(paused: boolean): boolean {
    if (this.paused === paused) return false
    this.paused = paused
    return true
  }
}
