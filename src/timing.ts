import { PunctuationPause, ReaderToken } from "./types";

const punctuationMap: Record<PunctuationPause, { short: number; long: number; paragraph: number }> = {
  off: { short: 1, long: 1, paragraph: 1 },
  light: { short: 1.1, long: 1.25, paragraph: 1.45 },
  normal: { short: 1.15, long: 1.35, paragraph: 1.65 },
  strong: { short: 1.25, long: 1.55, paragraph: 1.9 }
};

export function calculateDelay(token: ReaderToken, nextToken: ReaderToken | undefined, wpm: number, pause: PunctuationPause, sentencePauseMultiplier = 1.6): number {
  const base = 60000 / Math.max(1, wpm);
  const profile = punctuationMap[pause];

  let mult = 1;

  if (/[,:;]$/.test(token.text)) mult *= profile.short;
  if (/\.$/.test(token.text)) mult *= profile.long * Math.max(1, Math.min(10, sentencePauseMultiplier));
  if (nextToken && nextToken.paragraphIndex > token.paragraphIndex) mult *= profile.paragraph;

  const stripped = token.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (stripped.length >= 10) mult *= 1.1;
  if (stripped.length >= 14) mult *= 1.2;

  return Math.round(base * mult);
}

export function estimateRemainingMs(tokensLeft: number, wpm: number): number {
  const base = 60000 / Math.max(1, wpm);
  return Math.max(0, Math.round(tokensLeft * base));
}
