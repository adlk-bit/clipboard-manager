import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeText, transformText } from '../shared/text-tools'

test('merging preserves exact content, list order and input array', () => {
  const items = [' 甲\n乙 ', '丙', '丁']
  assert.equal(mergeText(items, 'blankLine'), ' 甲\n乙 \n\n丙\n\n丁')
  assert.equal(mergeText(items, 'tab', true), '丁\t丙\t 甲\n乙 ')
  assert.deepEqual(items, [' 甲\n乙 ', '丙', '丁'])
  assert.equal(mergeText(['a', 'b'], 'comma'), 'a, b')
  assert.equal(mergeText(['x'.repeat(10000), 'y'], 'newline').length, 10002)
})

test('line transforms handle Windows newlines and preserve intentional differences', () => {
  assert.equal(transformText(' a \r\n \r\nb\r', 'trimLines'), 'a\n\nb\n')
  assert.equal(transformText(' a \r\n\t\r\nb', 'removeBlankLines'), ' a \nb')
  assert.equal(transformText('a\r\nb\r\na\r\n a', 'deduplicateLines'), 'a\nb\n a')
  assert.equal(transformText(' 甲\r\n\t乙  丙 ', 'singleLine'), '甲 乙 丙')
  assert.equal(transformText('Ab中', 'uppercase'), 'AB中')
  assert.equal(transformText('Ab中', 'lowercase'), 'ab中')
})

test('JSON tools validate syntax and preserve numeric precision, duplicate keys, and escapes', () => {
  assert.equal(transformText('{"name":"测试","items":[1,true]}', 'formatJson'), '{\n  "name": "测试",\n  "items": [\n    1,\n    true\n  ]\n}')
  assert.equal(transformText('{ "n": 0.25, "s": "a  b" }', 'minifyJson'), '{"n":0.25,"s":"a  b"}')
  assert.throws(() => transformText('{broken}', 'formatJson'))
  const precise = '{"id":9007199254740993,"decimal":0.1234567890123456789,"n":1e400,"n":-0,"s":"\\u4e2d\\\""}'
  assert.equal(transformText(transformText(precise, 'formatJson'), 'minifyJson'), precise)
  assert.equal(transformText('{ "a": [], "b": {} }', 'formatJson'), '{\n  "a": [],\n  "b": {}\n}')
})
