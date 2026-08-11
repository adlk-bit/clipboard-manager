import assert from 'node:assert/strict'
import test from 'node:test'
import { MonitorPauseState } from '../electron/main/monitor-state'

test('clipboard monitoring can be paused and resumed without redundant transitions', () => {
  const state = new MonitorPauseState()
  assert.equal(state.isPaused(), false)
  assert.equal(state.canPoll(), true)
  assert.equal(state.setPaused(true), true)
  assert.equal(state.isPaused(), true)
  assert.equal(state.canPoll(), false)
  assert.equal(state.setPaused(true), false)
  assert.equal(state.setPaused(false), true)
  assert.equal(state.canPoll(), true)
})
