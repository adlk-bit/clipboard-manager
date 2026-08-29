import assert from 'node:assert/strict'
import test from 'node:test'
import { maskSensitivePreview } from '../src/lib/sensitive-content'

test('masks common private values while preserving enough context', () => {
  const result = maskSensitivePreview('手机 13812345678，邮箱 jimuzhe@example.com，身份证 11010519491231002X')

  assert.equal(result.isSensitive, true)
  assert.deepEqual(result.kinds.sort(), ['email', 'id-card', 'phone'])
  assert.match(result.text, /138•{4}5678/)
  assert.match(result.text, /ji•{5}@example\.com/)
  assert.match(result.text, /110•{10}002X/)
  assert.doesNotMatch(result.text, /13812345678|jimuzhe@example\.com|11010519491231002X/)
})

test('masks labelled secrets, bearer tokens, AWS keys, and valid bank cards', () => {
  const result = maskSensitivePreview('token=abcd1234 bearer AbCdEfGhIjKlMnOp AKIAIOSFODNN7EXAMPLE 4111 1111 1111 1111')

  assert.equal(result.isSensitive, true)
  assert.deepEqual(result.kinds.sort(), ['bank-card', 'secret'])
  assert.doesNotMatch(result.text, /abcd1234|AbCdEfGhIjKlMnOp|AKIAIOSFODNN7EXAMPLE|4111 1111 1111 1111/)
  assert.match(result.text, /4111 •••• •••• 1111/)
})

test('does not blur ordinary numbers or prose', () => {
  const input = '版本 1.1.2，订单 123456，今天完成构建。'
  assert.deepEqual(maskSensitivePreview(input), { text: input, kinds: [], isSensitive: false })
})
