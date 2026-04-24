import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import type RapidReaderPlugin from "./main";
import { splitWordByOrp } from "./orp";
import { calculateDelay, estimateRemainingMs } from "./timing";
import { ReaderSession } from "./types";

export const RAPID_READER_DOCKED_VIEW = "rapid-reader-docked-view";

export class RapidReaderDockedView extends ItemView {
  plugin: RapidReaderPlugin;
  private session: ReaderSession | null = null;
  private tokens = this.emptyTokens();
  private index = 0;
  private playing = false;
  private timeoutId: number | null = null;

  private headerInfoEl!: HTMLElement;
  private wordBeforeEl!: HTMLElement;
  private wordOrpEl!: HTMLElement;
  private wordAfterEl!: HTMLElement;
  private progressEl!: HTMLInputElement;
  private speedEl!: HTMLInputElement;
  private sidePanelEl!: HTMLElement;
  private playPauseBtn!: HTMLButtonElement;
  private speedInfoEl!: HTMLElement;
  private progressInfoEl!: HTMLElement;
  private sideParagraphEls: HTMLElement[] = [];
  private wpm = 500;

  constructor(leaf: WorkspaceLeaf, plugin: RapidReaderPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return RAPID_READER_DOCKED_VIEW;
  }

  getDisplayText(): string {
    return "Rapid Reader";
  }

  getIcon(): string {
    return "book-open";
  }

  async onOpen(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.addClass("rapid-reader-docked-root");
    this.wpm = this.plugin.settings.lastWpm || this.plugin.settings.defaultWpm;
    this.renderShell();
  }

  async onClose(): Promise<void> {
    this.stop();
  }

  setSession(session: ReaderSession): void {
    this.session = session;
    this.tokens = session.useSimplified ? session.simplifiedTokens : session.tokens;
    this.index = Math.max(0, Math.min(session.initialIndex, this.tokens.length - 1));
    this.wpm = this.plugin.settings.lastWpm || this.plugin.settings.defaultWpm;
    this.renderShell();
    this.renderSidePanel();
    this.renderCurrentWord();
  }

  private emptyTokens() {
    return [] as ReaderSession["tokens"];
  }

  private renderShell(): void {
    this.containerEl.empty();
    this.containerEl.addClass("rapid-reader-docked-root");
    const root = this.containerEl.createDiv({ cls: "rapid-reader-modal" });

    const top = root.createDiv({ cls: "rapid-reader-top" });
    top.createDiv({ text: this.session?.sourceName ?? "Rapid Reader", cls: "rapid-reader-filename" });

    const topActions = top.createDiv({ cls: "rapid-reader-top-actions" });
    this.headerInfoEl = topActions.createDiv({ cls: "rapid-reader-header-info" });

    const body = root.createDiv({ cls: "rapid-reader-body" });
    const readerPane = body.createDiv({ cls: "rapid-reader-pane" });

    const display = readerPane.createDiv({ cls: "rapid-reader-display" });
    this.wordBeforeEl = display.createDiv({ cls: "rapid-reader-word rapid-reader-word-before" });
    const pivotCol = display.createDiv({ cls: "rapid-reader-orp-col" });
    this.wordOrpEl = pivotCol.createSpan({ cls: "rapid-reader-word-orp" });
    this.wordAfterEl = display.createDiv({ cls: "rapid-reader-word rapid-reader-word-after" });

    this.sidePanelEl = body.createDiv({ cls: "rapid-reader-side" });

    const controls = root.createDiv({ cls: "rapid-reader-controls" });

    const btn = (label: string, action: () => void, icon?: string) => {
      const b = controls.createEl("button", { cls: "rapid-reader-btn", text: label });
      if (icon) {
        b.empty();
        setIcon(b, icon);
      }
      b.addEventListener("click", action);
      return b;
    };

    btn("Restart", () => this.jumpTo(0));
    btn("Back 10", () => this.move(-10));
    btn("Prev", () => this.move(-1));
    this.playPauseBtn = btn("Play/Pause", () => this.togglePlay(), "play") as HTMLButtonElement;
    btn("Next", () => this.move(1));
    btn("Forward 10", () => this.move(10));

    const speedWrap = root.createDiv({ cls: "rapid-reader-slider-wrap" });
    this.speedEl = speedWrap.createEl("input", { type: "range", cls: "rapid-reader-progress" });
    this.speedEl.min = String(this.plugin.settings.minWpm);
    this.speedEl.max = String(this.plugin.getMaxWpm());
    this.speedEl.step = "25";
    this.speedEl.value = String(this.wpm);
    this.speedEl.addEventListener("input", () => this.setWpm(Number(this.speedEl.value)));
    this.speedInfoEl = speedWrap.createDiv({ cls: "rapid-reader-slider-label" });

    const progressWrap = root.createDiv({ cls: "rapid-reader-slider-wrap" });
    this.progressEl = progressWrap.createEl("input", { type: "range", cls: "rapid-reader-progress" });
    this.progressEl.min = "0";
    this.progressEl.max = String(Math.max(0, this.tokens.length - 1));
    this.progressEl.step = "1";
    this.progressEl.value = String(this.index);
    this.progressEl.addEventListener("input", () => this.jumpTo(Number(this.progressEl.value)));
    this.progressInfoEl = progressWrap.createDiv({ cls: "rapid-reader-slider-label" });

    this.applyTheme(root);
    this.updateHeader();
    this.updatePlayPauseButton();
  }

  private applyTheme(root: HTMLElement): void {
    root.style.setProperty("--rapid-reader-font-size", `${this.plugin.settings.fontSize}px`);
    root.style.setProperty("--rapid-reader-orp-color", this.plugin.settings.orpColor);
    if (this.plugin.settings.textColor) root.style.setProperty("--rapid-reader-text-color", this.plugin.settings.textColor);
    if (this.plugin.settings.backgroundColor) root.style.setProperty("--rapid-reader-bg-color", this.plugin.settings.backgroundColor);
    if (this.plugin.settings.fontFamily) root.style.setProperty("--rapid-reader-font-family", this.plugin.settings.fontFamily);
  }

  private renderCurrentWord(): void {
    const token = this.tokens[this.index];
    if (!token) return;
    const parts = splitWordByOrp(token.text);
    this.wordBeforeEl.setText(parts.before);
    this.wordOrpEl.setText(parts.orp);
    this.wordAfterEl.setText(parts.after);
    this.progressEl.value = String(this.index);
    this.updateHeader();
    this.highlightSideParagraph(token.paragraphIndex);
  }

  private updateHeader(): void {
    const total = this.tokens.length;
    const current = Math.min(total, this.index + 1);
    const remaining = Math.max(0, total - current);
    const etaMs = estimateRemainingMs(remaining, this.wpm);
    const minutes = Math.floor(etaMs / 60000);
    const seconds = Math.floor((etaMs % 60000) / 1000);
    this.headerInfoEl?.setText(`${minutes}:${String(seconds).padStart(2, "0")} remaining`);
    this.speedInfoEl?.setText(`${this.wpm} w/min`);
    this.progressInfoEl?.setText(`${current}/${total}`);
  }

  private renderSidePanel(): void {
    if (!this.session) return;
    this.sidePanelEl.empty();
    this.sideParagraphEls = [];
    const source = this.session.useSimplified ? this.session.simplifiedText : this.session.text;
    const paragraphs = source.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    paragraphs.forEach((paragraph, index) => {
      const p = this.sidePanelEl.createEl("p", { text: paragraph, cls: "rapid-reader-paragraph" });
      p.addEventListener("click", () => {
        const tokenIndex = this.tokens.findIndex((token) => token.paragraphIndex >= index);
        this.jumpTo(tokenIndex >= 0 ? tokenIndex : 0);
      });
      this.sideParagraphEls.push(p);
    });
  }

  private highlightSideParagraph(paragraphIndex: number): void {
    this.sideParagraphEls.forEach((el, idx) => el.toggleClass("is-active", idx === paragraphIndex));
  }

  private move(delta: number): void {
    this.jumpTo(this.index + delta);
  }

  private jumpTo(idx: number): void {
    this.index = Math.max(0, Math.min(idx, this.tokens.length - 1));
    this.renderCurrentWord();
  }

  private setWpm(wpm: number): void {
    const clamped = Math.max(this.plugin.settings.minWpm, Math.min(this.plugin.getMaxWpm(), wpm));
    this.wpm = clamped;
    this.speedEl.value = String(clamped);
    this.plugin.settings.lastWpm = clamped;
    this.plugin.saveSettings();
    this.updateHeader();
  }

  private tick = () => {
    if (!this.playing) return;
    if (this.index >= this.tokens.length - 1) return this.stop();
    const token = this.tokens[this.index];
    this.move(1);
    const next = this.tokens[this.index + 1];
    const delay = calculateDelay(token, next, this.wpm, this.plugin.settings.punctuationPause);
    this.timeoutId = window.setTimeout(this.tick, delay);
  };

  private togglePlay(): void {
    if (this.playing) this.stop();
    else this.play();
  }

  private updatePlayPauseButton(): void {
    if (!this.playPauseBtn) return;
    this.playPauseBtn.empty();
    setIcon(this.playPauseBtn, this.playing ? "pause" : "play");
  }

  private play(): void {
    if (!this.tokens.length) {
      new Notice("No readable tokens found.");
      return;
    }
    this.stop();
    this.playing = true;
    this.updatePlayPauseButton();
    this.timeoutId = window.setTimeout(this.tick, 60000 / this.wpm);
  }

  private stop(): void {
    this.playing = false;
    this.updatePlayPauseButton();
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
