import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_ERRORS, MAX_MESSAGE, createAttentionProjection, foldAttention } from '../lib/projection.js'

function errorEvent(turn, message, code = 'ECONNRESET', time = 1000) {
  return {
    type: 'turn/end',
    seq: 1,
    time,
    data: { turn, reason: { kind: 'error', error: { message, code } } },
  }
}

test('completed and unrelated events leave the same state reference', () => {
  const state = { errors: [] }
  assert.equal(foldAttention(state, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } }), state)
  assert.equal(foldAttention(state, { type: 'turn/start', data: { turn: 2 } }), state)
  assert.equal(foldAttention(state, { type: 'step/end', data: { turn: 1, step: 1 } }), state)
})

test('a failed turn appends one structured error', () => {
  const next = foldAttention({ errors: [] }, errorEvent(3, 'socket hang up', 'ECONNRESET', 1234))
  assert.deepEqual(next.errors, [{ turn: 3, code: 'ECONNRESET', message: 'socket hang up', at: 1234 }])
})

test('missing fields fall back and long messages are truncated', () => {
  const long = 'x'.repeat(MAX_MESSAGE + 50)
  const next = foldAttention({ errors: [] }, { type: 'turn/end', time: 5, data: { turn: 1, reason: { kind: 'error', error: { message: long } } } })
  assert.equal(next.errors[0].code, 'UNKNOWN')
  assert.equal(next.errors[0].message.length, MAX_MESSAGE + 1)
  assert.ok(next.errors[0].message.endsWith('…'))
})

test('only the most recent errors are kept', () => {
  let state = { errors: [] }
  for (let turn = 1; turn <= MAX_ERRORS + 2; turn += 1) {
    state = foldAttention(state, errorEvent(turn, `boom ${turn}`, 'E', turn))
  }
  assert.equal(state.errors.length, MAX_ERRORS)
  assert.equal(state.errors[0].turn, 3)
  assert.equal(state.errors[MAX_ERRORS - 1].turn, MAX_ERRORS + 2)
})

test('projection metadata and wire schema are usable', () => {
  const projection = createAttentionProjection()
  assert.equal(projection.key, 'attention')
  assert.equal(projection.stateVersion, 1)
  const initial = projection.init()
  assert.deepEqual(initial, { errors: [] })
  const state = projection.apply(initial, errorEvent(2, 'nope'))
  const view = projection.wire.view(state)
  assert.deepEqual(projection.wire.viewSchema.parse(view), state)
})
