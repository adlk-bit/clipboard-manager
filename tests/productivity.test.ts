import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultTemplateValues, templateVariables, renderTemplate, validateTemplate, parseExcludedApps, normalizeSourceApp } from '../shared/productivity'
import { buildHistorySearch } from '../shared/history-query'
import initSqlJs from 'sql.js'
test('templates substitute repeated Chinese variables once without interpreting inserted placeholders', () => {
  const body = '{{ 姓名 }}，您好。{{姓名}} / {{date}} / {{time}}'
  assert.deepEqual(templateVariables(body), ['姓名', 'date', 'time'])
  const defaults = defaultTemplateValues(body, new Date(2026, 8, 6, 9, 7))
  assert.deepEqual(defaults, { 姓名: '', date: '2026-09-06', time: '09:07' })
  assert.equal(renderTemplate(body, { ...defaults, 姓名: '{{date}}' }), '{{date}}，您好。{{date}} / 2026-09-06 / 09:07')
  assert.throws(() => renderTemplate(body, defaults), /missing-value/)
  assert.throws(() => renderTemplate('{{constructor}}', {}), /missing-value/)
  assert.equal(renderTemplate('static phrase', {}), 'static phrase')
})
test('template validation rejects oversized bodies, expansions and excess variables', () => {
  assert.throws(() => validateTemplate('', 'hello'), /invalid-template/)
  assert.throws(() => validateTemplate('x', 'a'.repeat(10001)), /invalid-template/)
  assert.throws(() => templateVariables(Array.from({ length: 33 }, (_, i) => `{{${i}}}`).join('')), /variables-limit/)
  assert.throws(() => renderTemplate('{{x}}{{x}}', { x: 'a'.repeat(6000) }), /output-limit/)
})
test('source exclusions normalize exact basenames and reject paths or wildcard rules', () => {
  assert.deepEqual(parseExcludedApps('[" Chrome ","CHROME.EXE","KeePass.exe"]'), ['chrome.exe', 'keepass.exe'])
  for (const value of ['../secret', 'C:\\foo.exe', '*', 'test\napp', '..']) assert.equal(normalizeSourceApp(value), '')
  assert.throws(() => parseExcludedApps('["chrome.exe","*"]'))
  assert.throws(() => parseExcludedApps(JSON.stringify(Array(51).fill('app'))))
})
test('image OCR and source names participate in multiword literal search', async () => {
  const SQL = await initSqlJs(), db = new SQL.Database()
  try {
    db.run('CREATE TABLE items (content TEXT, favorite_folder TEXT, favorite_tags TEXT, ocr_text TEXT, source_app TEXT)')
    db.run('INSERT INTO items VALUES (NULL, ?, ?, ?, ?)', ['', '', 'Invoice 100% A_B 中文', 'fixture.exe'])
    const search = buildHistorySearch('中文 100% fixture.exe', true)
    assert.equal(db.exec('SELECT COUNT(*) FROM items WHERE 1=1' + search.clause, search.params)[0].values[0][0], 1)
    const noMatch = buildHistorySearch('AX_B', true)
    assert.equal(db.exec('SELECT COUNT(*) FROM items WHERE 1=1' + noMatch.clause, noMatch.params)[0].values[0][0], 0)
  } finally { db.close() }
})
