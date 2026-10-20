import z from '@deepseek-ai/schemastery'
import { LIMITS } from './config.js'

/** Plugin Config shown on the plugin page. Keep in sync with normalizeConfig(). */
export const Config = z.object({
  rounds: z
    .number()
    .min(LIMITS.rounds.min)
    .max(LIMITS.rounds.max)
    .step(1)
    .default(4)
    .description('问答轮数（1-8），4 轮 × 6 题约 24 题'),
  questionsPerRound: z
    .number()
    .min(LIMITS.questionsPerRound.min)
    .max(LIMITS.questionsPerRound.max)
    .step(1)
    .default(6)
    .description('每轮问题数（1-10），一题一页弹窗'),
  language: z
    .union(['zh', 'en'])
    .default('zh')
    .description('提示词与内置题库语言：zh 中文 / en English'),
  questionBankPath: z
    .string()
    .default('')
    .description('自定义题库 JSON 路径；留空使用内置题库。支持 ~ 与相对路径'),
  briefDir: z
    .string()
    .default('~/.dsh/inquiry')
    .description('《需求简报》保存目录（提示模型写到这里）'),
  autoLoadSkill: z
    .boolean()
    .default(true)
    .description('命令触发时是否在提示里要求先加载 inquiry-mode 技能'),
})
