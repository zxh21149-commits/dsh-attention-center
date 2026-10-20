import test from 'node:test'
import assert from 'node:assert/strict'
import { expandPath, loadBank, readBuiltinBank, validateBank } from '../lib/bank.js'

test('built-in banks load for both languages', () => {
  const zh = readBuiltinBank('zh')
  const en = readBuiltinBank('en')
  assert.ok(zh.dimensions.length >= 6)
  assert.ok(en.dimensions.length >= 4)
  assert.ok(zh.dimensions.every((dimension) => dimension.questions.length > 0))
})

test('loadBank falls back to built-in when no path is given', () => {
  const loaded = loadBank({ language: 'zh' })
  assert.equal(loaded.source, 'builtin')
  assert.equal(loaded.path, '')
  assert.deepEqual(loaded.warnings, [])
  assert.ok(loaded.bank.dimensions.length > 0)
})

test('a valid custom bank is loaded and normalized', () => {
  const custom = {
    dimensions: [{ title: 'Custom', questions: ['One?', { text: 'Two?', options: ['A', 'B'], multiSelect: true }] }],
  }
  const loaded = loadBank({
    language: 'zh',
    questionBankPath: './bank.json',
    readFile: () => JSON.stringify(custom),
  })
  assert.equal(loaded.source, 'custom')
  assert.equal(loaded.bank.dimensions[0].title, 'Custom')
  assert.deepEqual(loaded.bank.dimensions[0].questions[1].options, ['A', 'B'])
  assert.equal(loaded.bank.dimensions[0].questions[1].multiSelect, true)
})

test('invalid JSON falls back with a warning', () => {
  const warnings = []
  const loaded = loadBank({
    questionBankPath: './broken.json',
    readFile: () => '{not json',
    warn: (message) => warnings.push(message),
  })
  assert.equal(loaded.source, 'builtin')
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /回退内置题库/)
})

test('invalid bank shape falls back with a warning', () => {
  const warnings = []
  const loaded = loadBank({
    questionBankPath: './shape.json',
    readFile: () => JSON.stringify({ dimensions: [{ title: '', questions: [] }] }),
    warn: (message) => warnings.push(message),
  })
  assert.equal(loaded.source, 'builtin')
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /自定义题库无效/)
})

test('validateBank reports the offending fields', () => {
  assert.equal(validateBank(null).ok, false)
  const result = validateBank({ dimensions: [{ title: 'A', questions: [{ options: 'nope' }] }] })
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.includes('questions[0]')))
})

test('expandPath handles ~ and relative paths', () => {
  assert.equal(expandPath('~', { home: 'C:\\home' }), 'C:\\home')
  assert.equal(expandPath('~/briefs', { home: 'C:\\home' }), 'C:\\home\\briefs')
  assert.equal(expandPath('./x.json', { cwd: 'C:\\work' }), 'C:\\work\\x.json')
})
