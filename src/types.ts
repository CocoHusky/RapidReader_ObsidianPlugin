export type PunctuationPause = "off" | "light" | "normal" | "strong";

export interface RapidReaderSettings {
  defaultWpm: number;
  minWpm: number;
  maxWpmMode: "normal" | "advanced";
  fontSize: number;
  fontFamily: string;
  orpColor: string;
  textColor: string;
  backgroundColor: string;
  readerWidth: number;
  showCenterGuide: boolean;
  showSidePanelDefault: boolean;
  punctuationPause: PunctuationPause;
  replaceCodeBlocks: boolean;
  replaceInlineCode: boolean;
  replaceUrlsOnSimplify: boolean;
  autoplay: boolean;
  rememberPosition: boolean;
  warnLowReadability: boolean;
  lastWpm: number;
  progressByPath: Record<string, number>;
  sidePanelOpenByDefault?: boolean;
  defaultOpenMode: "modal" | "docked";
  fullWidthModal: boolean;
}

export interface ReaderToken {
  text: string;
  originalIndex: number;
  paragraphIndex: number;
  sentenceIndex: number;
  endsWith?: string;
  isPlaceholder?: boolean;
}

export interface ReadabilityAnalysis {
  wordCount: number;
  lineCount: number;
  codeBlockCount: number;
  inlineCodeCount: number;
  bulletLineCount: number;
  tableLineCount: number;
  urlCount: number;
  symbolHeavyTokenCount: number;
  averageLineLength: number;
  proseRatio: number;
  issues: string[];
  shouldWarn: boolean;
}

export interface PreparedReaderContent {
  cleanedText: string;
  simplifiedText: string;
  tokens: ReaderToken[];
  simplifiedTokens: ReaderToken[];
  analysis: ReadabilityAnalysis;
}
