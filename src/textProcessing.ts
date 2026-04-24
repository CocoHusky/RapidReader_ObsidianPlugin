import { RapidReaderSettings, ReadabilityAnalysis, ReaderToken } from "./types";

function countMatches(text: string, regex: RegExp): number {
  return (text.match(regex) ?? []).length;
}

function isSymbolHeavy(token: string): boolean {
  if (!token) return false;
  const symbolCount = countMatches(token, /[^\p{L}\p{N}]/gu);
  return token.length >= 4 && symbolCount / token.length > 0.5;
}

export function analyzeReadability(text: string): ReadabilityAnalysis {
  const lines = text.split(/\r?\n/);
  const words = text.match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu) ?? [];
  const tokens = text.split(/\s+/).filter(Boolean);

  const codeBlockCount = countMatches(text, /```[\s\S]*?```/g);
  const inlineCodeCount = countMatches(text, /`[^`]+`/g);
  const bulletLineCount = lines.filter((line) => /^\s*([-*+]\s+|\d+\.\s+)/.test(line)).length;
  const tableLineCount = lines.filter((line) => /\|/.test(line) && /\S/.test(line)).length;
  const urlCount = countMatches(text, /https?:\/\/\S+/g);
  const symbolHeavyTokenCount = tokens.filter(isSymbolHeavy).length;
  const avgLineLength = lines.length ? lines.reduce((sum, line) => sum + line.length, 0) / lines.length : 0;

  const proseSignals = words.length;
  const structureNoise = bulletLineCount + tableLineCount + urlCount + symbolHeavyTokenCount + codeBlockCount * 6;
  const proseRatio = proseSignals > 0 ? Math.max(0, 1 - structureNoise / (proseSignals + structureNoise)) : 0;

  const issues: string[] = [];
  if (codeBlockCount > 0) issues.push(`${codeBlockCount} code block(s) will be replaced with [code block].`);
  if (inlineCodeCount > 5) issues.push(`${inlineCodeCount} inline code span(s) detected.`);
  if (bulletLineCount >= 8) issues.push(`${bulletLineCount} bullet/list lines detected.`);
  if (tableLineCount >= 4) issues.push(`${tableLineCount} table-like lines may be replaced with [table].`);
  if (urlCount >= 4) issues.push("Many URLs detected.");
  if (avgLineLength > 160) issues.push("Very long lines detected.");
  if (symbolHeavyTokenCount >= 12) issues.push("Many symbol-heavy tokens detected.");
  if (proseRatio < 0.45) issues.push("Low prose ratio; this may read choppily.");
  if (words.length < 40) issues.push("Very short document; speed-reading may be less useful.");
  if (words.length > 7000) issues.push("Very long document detected.");

  const headingLines = lines.filter((line) => /^\s*#+\s+/.test(line)).length;
  if (headingLines > 0 && headingLines >= Math.floor(lines.length * 0.6)) {
    issues.push("Document appears heading-heavy.");
  }

  return {
    wordCount: words.length,
    lineCount: lines.length,
    codeBlockCount,
    inlineCodeCount,
    bulletLineCount,
    tableLineCount,
    urlCount,
    symbolHeavyTokenCount,
    averageLineLength: Number(avgLineLength.toFixed(2)),
    proseRatio: Number(proseRatio.toFixed(2)),
    issues,
    shouldWarn: issues.length > 0
  };
}

function normalizeParagraphWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function stripMarkdownCommon(text: string, settings: RapidReaderSettings, forSimplify: boolean): string {
  let out = text;

  out = out.replace(/```[\s\S]*?```/g, settings.replaceCodeBlocks ? "\n[code block]\n" : "\n");

  out = out.replace(/!\[[^\]]*\]\([^\)]+\)/g, "[image]");
  out = out.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, "$1");

  if (settings.replaceInlineCode) {
    out = out.replace(/`[^`]+`/g, "[code]");
  }

  out = out.replace(/^\s*#{1,6}\s*/gm, "");

  out = out.replace(/\*\*([^*]+)\*\*/g, "$1");
  out = out.replace(/__([^_]+)__/g, "$1");
  out = out.replace(/\*([^*]+)\*/g, "$1");
  out = out.replace(/_([^_]+)_/g, "$1");
  out = out.replace(/~~([^~]+)~~/g, "$1");

  out = out.replace(/^\s*\|.*\|\s*$/gm, "[table]");

  if (forSimplify) {
    out = out.replace(/^\s*[-*+]\s+/gm, "- ");
    out = out.replace(/^\s*\d+\.\s+/gm, "- ");
    out = out.replace(/^\s*-\s+/gm, "\n");

    if (settings.replaceUrlsOnSimplify) {
      out = out.replace(/https?:\/\/\S+/g, "[link]");
    }

    out = out.replace(/[\p{S}\p{C}]{4,}/gu, "[information]");
  }

  return normalizeParagraphWhitespace(out);
}

export function cleanMarkdownText(text: string, settings: RapidReaderSettings): string {
  return stripMarkdownCommon(text, settings, false);
}

export function simplifyText(text: string, settings: RapidReaderSettings): string {
  return stripMarkdownCommon(text, settings, true)
    .replace(/\n{2,}/g, "\n\n")
    .trim();
}

export function tokenizeText(text: string): ReaderToken[] {
  const paragraphs = text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const tokens: ReaderToken[] = [];
  let sentenceIndex = 0;

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const parts = paragraph.split(/\s+/).filter(Boolean);
    parts.forEach((word) => {
      const endsWith = /[.!?]$/.test(word) ? word[word.length - 1] : undefined;
      tokens.push({
        text: word,
        originalIndex: tokens.length,
        paragraphIndex,
        sentenceIndex,
        endsWith,
        isPlaceholder: /^\[(code|table|image|link|information)/.test(word)
      });

      if (endsWith) sentenceIndex += 1;
    });
  });

  return tokens;
}
