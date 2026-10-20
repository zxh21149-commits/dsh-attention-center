import { Config } from './lib/config-schema.js'
import { normalizeConfig } from './lib/config.js'
import { loadBank } from './lib/bank.js'
import { buildSkillContent, skillMeta } from './lib/prompt.js'
import { commandDefinitions, createCommandHandler } from './lib/commands.js'

/**
 * inquiry half of dsh-attention-center (the PTC suite).
 *
 * Registers one embedded skill (`inquiry-mode`) and three slash commands
 * (`/pao`, `/pau`, `/inquiry`). The skill body is generated from the plugin
 * config and the effective question bank, so the preset and the commands share
 * one source of truth.
 */
export const name = 'dsh-attention-center/inquiry'
export const inject = ['commands', 'skills']

export { Config }

export function apply(ctx, rawConfig = {}) {
  const config = normalizeConfig(rawConfig)
  const loaded = loadBank({ language: config.language, questionBankPath: config.questionBankPath })
  const meta = skillMeta(config)
  const skillContent = buildSkillContent({
    config,
    bank: loaded.bank,
    source: loaded.source,
    path: loaded.path,
    warnings: loaded.warnings,
  })
  const handler = createCommandHandler({ config })

  ctx.effect(function* () {
    yield ctx.skills.register({
      name: 'inquiry-mode',
      description: meta.description,
      whenToUse: meta.whenToUse,
      content: skillContent,
      source: 'runtime',
      invocation: { modelInvocable: true, userInvocable: true },
    })
    for (const definition of commandDefinitions({ config, handler })) {
      yield ctx.commands.register(definition)
    }
  }, 'dsh-inquiry-mode lifecycle')
}
