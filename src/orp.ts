export function getOrpIndex(word: string): number {
  const length = [...word].length;
  if (length <= 1) return 0;
  if (length <= 5) return 1;
  if (length <= 9) return 2;
  if (length <= 13) return 3;
  return 4;
}

export function splitWordByOrp(word: string): { before: string; orp: string; after: string } {
  if (!word) return { before: "", orp: "", after: "" };
  const chars = [...word];
  const rawIndex = getOrpIndex(word);
  const index = Math.min(rawIndex, chars.length - 1);
  return {
    before: chars.slice(0, index).join(""),
    orp: chars[index] ?? "",
    after: chars.slice(index + 1).join("")
  };
}
