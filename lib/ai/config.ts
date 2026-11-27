// lib/ai/config.ts
// The ONE place that names AI providers and models. Plain values, no SDK imports,
// so anything can import it: the schema, the seed scripts, even client components.
// Each setting can be overridden with an env var; the defaults are what we use today.

export const AI = {
  chat: {
    provider: process.env.AI_CHAT_PROVIDER ?? 'anthropic',
    answer: process.env.AI_ANSWER_MODEL ?? 'claude-sonnet-5', // writes the cited answers
    fast: process.env.AI_FAST_MODEL ?? 'claude-haiku-4-5', // small jobs, e.g. rewriting follow-ups
  },
  embedding: {
    provider: 'voyage',
    model: 'voyage-4',
    // Must match the vector column in lib/schema.ts. Changing the embedding model
    // means re-embedding every document; see the note at the bottom of embeddings.ts.
    dimensions: 1024,
  },
} as const


/**
 * Why the embedding settings aren't env vars: 
 * you can switch the chat model any time, because 
 * each answer stands alone. The embedding model 
 * can't be changed by flipping a setting: every 
 * stored vector was made by voyage-4, and a 
 * question embedded by a different model can't 
 * be compared with them. Hard-coding it 
 * means nobody can break search by editing 
 * one env var.
 */