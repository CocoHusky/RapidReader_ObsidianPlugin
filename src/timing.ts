import { PunctuationPause, ReaderToken } from "./types";

const punctuationMap: Record<PunctuationPause, { short: number; long: number; paragraph: number }> = {
  off: { short: 1, long: 1, paragraph: 1 },
  light: { short: 1.12, long: 1.3, paragraph: 1.5 },
  normal: { short: 1.2, long: 1.5, paragraph: 1.8 },
  strong: { short: 1.35, long: 1.75, paragraph: 2.2 }
};

export function calculateDelay(token: ReaderToken, nextToken: ReaderToken | undefined, wpm: number, pause: PunctuationPause): number {
  const base = 60000 / Math.max(1, wpm);
  const profile = punctuationMap[pause];

  let mult = 1;

  if (/[,:;]$/.test(token.text)) mult *= profile.short;
  if (/[.!?]$/.test(token.text)) mult *= profile.long;
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
