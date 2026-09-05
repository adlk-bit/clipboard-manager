import assert from 'node:assert/strict'
import test from 'node:test'
import initSqlJs from 'sql.js'
import { buildHistorySearch, matchesHistoryContentType, normalizeHistoryContentType } from '../shared/history-query'

test('search combines words across content and metadata and escapes SQL wildcards', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  try {
    db.run('CREATE TABLE items (id INTEGER, content TEXT, favorite_folder TEXT, favorite_tags TEXT)')
    const rows = [
      [1, '报价 100% A_B C:\\notes', '工作', '紧急'],
      [2, '报价 1000 AXB', '私人', '归档'],
      [3, null, '工作', '紧急,图片'],
    ]
    for (const row of rows) db.run('INSERT INTO items VALUES (?, ?, ?, ?)', row)
    const search = (value: string) => {
      const { clause, params } = buildHistorySearch(value)
      return db.exec(`SELECT id FROM items WHERE 1=1${clause} ORDER BY id`, params)[0]?.values.flat() || []
    }
    assert.deepEqual(search('紧急 工作'), [1, 3])
    assert.deepEqual(search('  工作\n报价  '), [1])
    assert.deepEqual(search('%'), [1])
    assert.deepEqual(search('_'), [1])
    assert.deepEqual(search('C:\\notes'), [1])
    assert.deepEqual(search("' OR 1=1 --"), [])
    assert.deepEqual(search(' \t '), [1, 2, 3])
  } finally { db.close() }
})

test('text, link and image filters are disjoint and recognize existing URL rules', () => {
  for (const content of ['https://example.com/path', 'www.example.com', ' example.com ']) {
    const item = { type: 'text', content }
    assert.equal(matchesHistoryContentType(item, 'url'), true)
    assert.equal(matchesHistoryContentType(item, 'text'), false)
  }
  for (const content of ['see https://example.com', 'javascript:alert(1)', 'hello', null]) {
    assert.equal(matchesHistoryContentType({ type: 'text', content }, 'url'), false)
    assert.equal(matchesHistoryContentType({ type: 'text', content }, 'text'), true)
  }
  assert.equal(matchesHistoryContentType({ type: 'image', content: null }, 'image'), true)
  assert.equal(matchesHistoryContentType({ type: 'image', content: null }, 'text'), false)
  assert.equal(normalizeHistoryContentType({ type: 'url' }), 'all')
})
