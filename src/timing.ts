import { ReaderToken } from "./types";

function clampMultiplier(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(100, value));
}

function hasSentenceEndingPunctuation(text: string): boolean {
  return /[.!?](?:["')\]]+)?$/.test(text);
}

function hasDecimalNumber(text: string): boolean {
  return /\b\d+\.\d+\b/.test(text);
}

function hasShortPausePunctuation(text: string): boolean {
  return /[,;:](?:["')\]]+)?$/.test(text);
}

export function calculateDelay(
  token: ReaderToken,
  nextToken: ReaderToken | undefined,
  wpm: number,
  punctuationPauseMultiplier: number,
  sentencePauseMultiplier: number,
  paragraphPauseMultiplier: number,
  previousToken?: ReaderToken
): number {
  const base = 60000 / Math.max(1, wpm);
  let mult = 1;

  const punctMult = clampMultiplier(punctuationPauseMultiplier);
  const sentenceMult = clampMultiplier(sentencePauseMultiplier);
  const paragraphMult = clampMultiplier(paragraphPauseMultiplier);

  if (hasShortPausePunctuation(token.text) || hasDecimalNumber(token.text)) mult *= punctMult;
  if (hasSentenceEndingPunctuation(token.text)) mult *= sentenceMult;
  if (nextToken && nextToken.paragraphIndex > token.paragraphIndex) mult *= paragraphMult;

  if (previousToken && hasSentenceEndingPunctuation(previousToken.text)) {
    mult *= sentenceMult;
  }

  const stripped = token.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (stripped.length >= 10) mult *= 1.1;
  if (stripped.length >= 14) mult *= 1.2;

  return Math.round(base * mult);
}

export function estimateRemainingMs(tokensLeft: number, wpm: number): number {
  const base = 60000 / Math.max(1, wpm);
  return Math.max(0, Math.round(tokensLeft * base));
}
