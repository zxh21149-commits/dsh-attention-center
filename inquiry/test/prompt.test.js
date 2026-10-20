import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeConfig } from '../lib/config.js'
import { loadBank } from '../lib/bank.js'
import { buildCommandPrompt, buildSkillContent, skillMeta } from '../lib/prompt.js'

const zh = loadBank({ language: 'zh' })
const en = loadBank({ language: 'en' })

test('skill content carries the configured shape and the bank', () => {
  const config = normalizeConfig({ rounds: 3, questionsPerRound: 5, briefDir: 'D:/briefs' })
  const content = buildSkillContent({ config, bank: zh.bank, source: 'builtin', path: '' })
  assert.match(content, /轮数：3/)
  assert.match(content, /每轮题数：5（总计约 15 题）/)
  assert.match(content, /D:\/briefs/)
  assert.match(content, /触发场景/)
  assert.match(content, /\(Recommended\)/)
  assert.match(content, /需求简报/)
})

test('english skill content switches language and renders the english bank', () => {
  const config = normalizeConfig({ language: 'en', rounds: 2, questionsPerRound: 4 })
  const content = buildSkillContent({ config, bank: en.bank, source: 'builtin', path: '' })
  assert.match(content, /# Inquiry Mode/)
  assert.match(content, /rounds: 2/)
  assert.match(content, /When does this get used\?/)
})

test('custom bank notes and warnings are rendered', () => {
  const config = normalizeConfig({})
  const content = buildSkillContent({
    config,
    bank: { dimensions: [{ id: 'x', title: 'X', questions: [{ text: 'Q?', options: [], multiSelect: false }] }], notes: 'NOTE-HERE' },
    source: 'custom',
    path: 'C:/custom.json',
    warnings: ['WARN-HERE'],
  })
  assert.match(content, /custom: C:\/custom\.json/)
  assert.match(content, /NOTE-HERE/)
  assert.match(content, /WARN-HERE/)
})

test('command prompt includes config numbers, brief dir and seed', () => {
  const config = normalizeConfig({ rounds: 5, questionsPerRound: 7, briefDir: '~/my-briefs' })
  const prompt = buildCommandPrompt({ config, rawInput: '  我想做个插件  ' })
  assert.match(prompt, /每轮 7 题/)
  assert.match(prompt, /共 5 轮/)
  assert.match(prompt, /~\/my-briefs/)
  assert.match(prompt, /我想做个插件/)
  assert.match(prompt, /先加载 `inquiry-mode` 技能/)
})

test('autoLoadSkill=false drops the load instruction and empty seed adds nothing', () => {
  const config = normalizeConfig({ autoLoadSkill: false })
  const prompt = buildCommandPrompt({ config, rawInput: '   ' })
  assert.match(prompt, /技能可选/)
  assert.doesNotMatch(prompt, /我的补充/)
})

test('english command prompt is generated in english', () => {
  const config = normalizeConfig({ language: 'en' })
  const prompt = buildCommandPrompt({ config, rawInput: 'a plugin idea' })
  assert.match(prompt, /Inquiry mode · triggered by command/)
  assert.match(prompt, /a plugin idea/)
})

test('skillMeta follows the language', () => {
  assert.match(skillMeta(normalizeConfig({ language: 'zh' })).description, /问答式澄清/)
  assert.match(skillMeta(normalizeConfig({ language: 'en' })).description, /Inquiry clarification/)
})
