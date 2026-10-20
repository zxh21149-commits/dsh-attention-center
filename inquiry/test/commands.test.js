import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeConfig } from '../lib/config.js'
import { COMMAND_NAMES, commandDefinitions, createCommandHandler } from '../lib/commands.js'

function fakeAgent() {
  const calls = []
  return {
    calls,
    followup: async (message) => {
      calls.push(message)
    },
  }
}

test('three command names are defined, all sharing one handler', () => {
  const config = normalizeConfig({})
  const handler = () => {}
  const definitions = commandDefinitions({ config, handler })
  assert.deepEqual(definitions.map((definition) => definition.name), [...COMMAND_NAMES])
  assert.ok(definitions.every((definition) => definition.handler === handler))
  assert.ok(definitions.every((definition) => definition.description.length > 0))
})

test('handler posts a user-role followup carrying the prompt', async () => {
  const config = normalizeConfig({ rounds: 3, questionsPerRound: 5 })
  const handler = createCommandHandler({ config })
  const agent = fakeAgent()
  const result = await handler({ agent, rawInput: 'seed text', signal: { aborted: false } })
  assert.equal(result.kind, 'success')
  assert.equal(agent.calls.length, 1)
  assert.equal(agent.calls[0].source.kind, 'user')
  assert.match(agent.calls[0].content[0].text, /seed text/)
  assert.match(agent.calls[0].content[0].text, /每轮 5 题/)
})

test('handler reports an error when the agent cannot be woken', async () => {
  const config = normalizeConfig({})
  const handler = createCommandHandler({ config })
  const result = await handler({
    agent: { followup: async () => { throw new Error('boom') } },
    rawInput: '',
    signal: { aborted: false },
  })
  assert.equal(result.kind, 'error')
  assert.match(result.text, /boom/)
})

test('an aborted signal returns an error without calling the agent', async () => {
  const config = normalizeConfig({})
  const handler = createCommandHandler({ config })
  const agent = fakeAgent()
  const result = await handler({ agent, rawInput: '', signal: { aborted: true } })
  assert.equal(result.kind, 'error')
  assert.equal(agent.calls.length, 0)
})
