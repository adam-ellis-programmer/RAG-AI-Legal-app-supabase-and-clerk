// lib/ai/models.ts
// Chat models by JOB, not by company. Routes ask for chatModel('answer');
// only this file knows that means Anthropic's Sonnet today.
import { anthropic } from '@ai-sdk/anthropic'
import type { LanguageModel } from 'ai'
import { AI } from './config'

export type ChatTask = 'answer' | 'fast'

export function chatModel(task: ChatTask): LanguageModel {
  const modelId = AI.chat[task]
  switch (AI.chat.provider) {
    case 'anthropic':
      return anthropic(modelId)
    // To add a provider: npm install @ai-sdk/openai (or google…), import it above,
    // and add e.g.  case 'openai': return openai(modelId)
    default:
      throw new Error(`Unknown AI_CHAT_PROVIDER "${AI.chat.provider}"`)
  }
}