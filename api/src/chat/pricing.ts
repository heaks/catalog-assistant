// USD per million tokens (Anthropic pricing, checked 2026-11).
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export function costUsd(model: string, usage: Usage): number | null {
  const price = PRICING[model];
  if (!price) return null;
  const cost =
    (usage.inputTokens * price.input + usage.outputTokens * price.output) /
    1_000_000;
  return Number(cost.toFixed(5));
}
