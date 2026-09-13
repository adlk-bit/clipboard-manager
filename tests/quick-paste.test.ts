import test from 'node:test'
import assert from 'node:assert/strict'
import { QuickPasteSession } from '../shared/quick-paste'
import { acquirePaste, releasePaste } from '../electron/main/paste-operation'

test('quick paste consumes each hotkey authorization exactly once', () => {
  const state = new QuickPasteSession<string>()
  const token = state.begin()!
  assert.equal(state.bind(token, 'original-window'), true)
  assert.deepEqual(state.claim(token), { target: 'original-window' })
  assert.equal(state.claim(token), null)
  assert.equal(state.begin(), null, 'Cannot replace an in-flight target')
  state.finish()
  assert.equal(state.claim(token), null, 'Completion must not re-enable a stale target')
})
test('cancellation rejects late capture results and stale renderer requests', () => {
  const state = new QuickPasteSession<string>()
  const old = state.begin()!
  state.cancel()
  assert.equal(state.bind(old, 'late-result'), false)
  assert.equal(state.claim(old), null)
  const next = state.begin()!
  state.bind(next, 'new-window')
  assert.equal(state.bind(old, 'wrong-window'), false)
  assert.equal(state.claim(old), null)
  assert.deepEqual(state.claim(next), { target: 'new-window' })
})
test('unavailable targets remain a one-use copy-only operation', () => {
  const state = new QuickPasteSession<string>()
  const token = state.begin()!
  assert.deepEqual(state.claim(token), { target: null })
  state.finish()
  assert.equal(state.claim(token), null)
  const restarted = new QuickPasteSession<string>()
  assert.equal(restarted.status(String).active, false)
  assert.equal(restarted.claim(token), null)
})
test('quick paste and queue cannot inject concurrently', () => {
  assert.equal(acquirePaste(), true)
  assert.equal(acquirePaste(), false)
  releasePaste()
  assert.equal(acquirePaste(), true)
  releasePaste()
})
