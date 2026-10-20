import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_CONFIG, LIMITS, normalizeConfig, totalQuestions } from '../lib/config.js'

test('defaults fill a complete config', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG)
  assert.deepEqual(normalizeConfig({}), DEFAULT_CONFIG)
  assert.deepEqual(normalizeConfig(null), DEFAULT_CONFIG)
})

test('rounds and questionsPerRound are clamped to limits', () => {
  assert.equal(normalizeConfig({ rounds: 99 }).rounds, LIMITS.rounds.max)
  assert.equal(normalizeConfig({ rounds: 0 }).rounds, LIMITS.rounds.min)
  assert.equal(normalizeConfig({ questionsPerRound: 99 }).questionsPerRound, LIMITS.questionsPerRound.max)
  assert.equal(normalizeConfig({ questionsPerRound: -3 }).questionsPerRound, LIMITS.questionsPerRound.min)
  assert.equal(normalizeConfig({ rounds: 3.9 }).rounds, 3)
})

test('invalid values fall back without throwing', () => {
  const config = normalizeConfig({ rounds: 'x', language: 'fr', briefDir: '   ', autoLoadSkill: 'yes' })
  assert.equal(config.rounds, DEFAULT_CONFIG.rounds)
  assert.equal(config.language, 'zh')
  assert.equal(config.briefDir, DEFAULT_CONFIG.briefDir)
  assert.equal(config.autoLoadSkill, true)
})

test('strings are trimmed and language is validated', () => {
  const config = normalizeConfig({
    language: 'en',
    questionBankPath: '  ./bank.json  ',
    briefDir: '  ./briefs  ',
    autoLoadSkill: false,
  })
  assert.equal(config.language, 'en')
  assert.equal(config.questionBankPath, './bank.json')
  assert.equal(config.briefDir, './briefs')
  assert.equal(config.autoLoadSkill, false)
})

test('totalQuestions multiplies the configured shape', () => {
  assert.equal(totalQuestions({ rounds: 4, questionsPerRound: 6 }), 24)
})
