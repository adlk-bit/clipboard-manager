import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { useStore } from '../src/stores/useStore'
import type { HistoryItem } from '../src/types'

const initialState = useStore.getState()
const pending: Array<{ args: unknown[]; resolve: (items: HistoryItem[]) => void; reject: (error: Error) => void }> = []
const item = (id: number) => ({ id, type: 'text', content: String(id) } as HistoryItem)

beforeEach(() => {
  pending.length = 0
  useStore.setState(initialState, true)
  Object.assign(globalThis, { window: { api: {
    getHistory: (...args: unknown[]) => new Promise<HistoryItem[]>((resolve, reject) => pending.push({ args, resolve, reject })),
    getFavoriteFolders: async () => ['工作'],
  } } })
})
afterEach(() => {
  const timer = useStore.getState()._searchTimer
  if (timer) clearTimeout(timer)
  useStore.setState(initialState, true)
})

test('a slower old response cannot overwrite newer history', async () => {
  const first = useStore.getState().loadHistory()
  const second = useStore.getState().loadHistory()
  pending[1].resolve([item(2)])
  await second
  pending[0].resolve([item(1)])
  await first
  assert.deepEqual(useStore.getState().historyItems.map((entry) => entry.id), [2])
})

test('typing invalidates in-flight history before the debounce runs', async () => {
  const first = useStore.getState().loadHistory()
  useStore.getState().setSearchQuery('工作')
  pending[0].resolve([item(1)])
  await first
  assert.equal(useStore.getState().historyItems.length, 0)
  assert.equal(useStore.getState().historyLoading, true)
  const latest = useStore.getState().loadHistory()
  assert.equal(pending[1].args[0], '工作')
  pending[1].resolve([item(2)])
  await latest
  assert.equal(useStore.getState().historyLoading, false)
})

test('navigation cancels search timers and rejects results from the old page', async () => {
  const first = useStore.getState().loadHistory()
  useStore.getState().setSearchQuery('old')
  useStore.getState().setCurrentPage('favorites')
  assert.equal(useStore.getState()._searchTimer, null)
  assert.equal(pending[1].args[1], 'favorites')
  pending[1].resolve([item(3)])
  await Promise.resolve()
  pending[0].resolve([item(1)])
  await first
  assert.deepEqual(useStore.getState().historyItems.map((entry) => entry.id), [3])
  await useStore.getState().loadHistory('old', 'all')
  assert.equal(pending.length, 2)
})

test('filtering clears hidden selections and refresh removes deleted selections', async () => {
  useStore.setState({ historyItems: [item(1), item(2)], selectedIds: new Set([1, 2]), keyboardActiveId: 2 })
  const refresh = useStore.getState().loadHistory()
  pending[0].resolve([item(1)])
  await refresh
  assert.deepEqual([...useStore.getState().selectedIds], [1])
  assert.equal(useStore.getState().keyboardActiveId, null)
  useStore.getState().setContentType('url')
  assert.equal(pending[1].args[4], 'url')
  assert.equal(useStore.getState().selectedIds.size, 0)
  pending[1].resolve([])
  await Promise.resolve()
})

test('leaving history prevents later responses from updating the new page', async () => {
  const first = useStore.getState().loadHistory()
  useStore.getState().setCurrentPage('emoji')
  pending[0].resolve([item(1)])
  await first
  assert.equal(useStore.getState().historyItems.length, 0)
  assert.equal(useStore.getState().historyLoading, false)
})
