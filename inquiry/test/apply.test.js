import test from 'node:test'
import assert from 'node:assert/strict'
import { Config, apply, inject, name } from '../index.js'

function makeCtx() {
  const skills = []
  const commands = []
  const ctx = {
    skills: { register: (skill) => { skills.push(skill); return () => {} } },
    commands: { register: (definition) => { commands.push(definition); return () => {} } },
    effect: (fn) => {
      const iterator = fn()
      let step = iterator.next()
      while (!step.done) step = iterator.next()
      return () => {}
    },
  }
  return { ctx, skills, commands }
}

test('plugin identity and injection are declared', () => {
  assert.equal(name, 'dsh-attention-center/inquiry')
  assert.deepEqual(inject, ['commands', 'skills'])
  assert.equal(typeof Config, 'function')
  assert.ok(JSON.stringify(Config.toJSON()).includes('questionsPerRound'))
})

test('apply registers one embedded skill and three commands', () => {
  const { ctx, skills, commands } = makeCtx()
  apply(ctx, { rounds: 3, questionsPerRound: 5 })
  assert.equal(skills.length, 1)
  assert.equal(skills[0].name, 'inquiry-mode')
  assert.equal(skills[0].source, 'runtime')
  assert.deepEqual(skills[0].invocation, { modelInvocable: true, userInvocable: true })
  assert.match(skills[0].content, /轮数：3/)
  assert.match(skills[0].content, /每轮题数：5/)
  assert.deepEqual(commands.map((definition) => definition.name), ['pao', 'pau', 'inquiry'])
})

test('apply normalizes a broken config instead of failing', () => {
  const { ctx, skills } = makeCtx()
  apply(ctx, { rounds: 999, language: 'fr', questionBankPath: './missing.json' })
  assert.match(skills[0].content, /轮数：8/)
  assert.match(skills[0].content, /题库：内置/)
})
