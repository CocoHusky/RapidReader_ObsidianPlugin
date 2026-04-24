import { Modal, Notice, setIcon } from "obsidian";
import type RapidReaderPlugin from "./main";
import { splitWordByOrp } from "./orp";
import { calculateDelay, estimateRemainingMs } from "./timing";
import { ReaderToken } from "./types";

export interface ReaderSession {
  sourceName: string;
  sourcePath: string;
  text: string;
  simplifiedText: string;
  useSimplified: boolean;
  tokens: ReaderToken[];
  simplifiedTokens: ReaderToken[];
  initialIndex: number;
}

class RapidReaderHelpModal extends Modal {
  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h3", { text: "Rapid Reader keyboard shortcuts" });
    const list = this.contentEl.createEl("ul");

    const shortcuts = [
      ["Space", "Play / Pause"],
      ["R", "Restart"],
      ["Left Arrow", "Previous word"],
      ["Right Arrow", "Next word"],
      ["Shift + Left", "Back 10 words"],
      ["Shift + Right", "Forward 10 words"],
      ["Up Arrow", "Increase speed by 25 WPM"],
      ["Down Arrow", "Decrease speed by 25 WPM"],
      ["[", "Decrease speed by 50 WPM"],
      ["]", "Increase speed by 50 WPM"],
      ["H", "Open help"],
      [",", "Open settings"],
      ["Escape", "Close reader"]
    ];

    shortcuts.forEach(([keys, action]) => {
      const li = list.createEl("li");
      li.createSpan({ text: `${keys}: ` });
      li.createSpan({ text: action });
    });
  }
}

export class RapidReaderModal extends Modal {
  private plugin: RapidReaderPlugin;
  private session: ReaderSession;
  private tokens: ReaderToken[];
  private index: number;
  private playing = false;
  private timeoutId: number | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  private wpm: number;
  private sidePanelOpen: boolean;

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

  constructor(plugin: RapidReaderPlugin, session: ReaderSession) {
    super(plugin.app);
    this.plugin = plugin;
    this.session = session;
    this.tokens = session.useSimplified ? session.simplifiedTokens : session.tokens;
    this.index = Math.max(0, Math.min(session.initialIndex, this.tokens.length - 1));
    this.wpm = plugin.settings.lastWpm || plugin.settings.defaultWpm;
    this.sidePanelOpen = plugin.settings.showSidePanelDefault;
  }

  onOpen(): void {
    this.modalEl.addClass("rapid-reader-modal-wrap");
    if (this.plugin.settings.fullWidthModal) {
      this.modalEl.style.setProperty("--rapid-reader-modal-width", "min(92vw, 1800px)");
      this.modalEl.style.setProperty("--rapid-reader-modal-max-width", "1800px");
      this.modalEl.style.setProperty("--rapid-reader-modal-height", "min(82vh, 960px)");
      this.modalEl.style.setProperty("--rapid-reader-modal-max-height", "960px");
    } else {
      this.modalEl.style.setProperty("--rapid-reader-modal-width", "min(80vw, 1200px)");
      this.modalEl.style.setProperty("--rapid-reader-modal-max-width", "1200px");
      this.modalEl.style.setProperty("--rapid-reader-modal-height", "min(76vh, 860px)");
      this.modalEl.style.setProperty("--rapid-reader-modal-max-height", "860px");
    }
    this.contentEl.empty();
    this.buildLayout();
    this.modalEl.tabIndex = -1;
    this.modalEl.focus();
    this.renderSidePanel();
    this.renderCurrentWord();
    this.applyTheme();
    this.updatePlayPauseButton();
    if (this.plugin.settings.autoplay) this.play();
  }

  onClose(): void {
    this.stop();
    if (this.keyHandler) this.modalEl.removeEventListener("keydown", this.keyHandler, true);
    this.contentEl.empty();
  }

  private buildLayout(): void {
    const root = this.contentEl.createDiv({ cls: "rapid-reader-modal" });
    root.style.width = `${this.plugin.settings.readerWidth}px`;

    const top = root.createDiv({ cls: "rapid-reader-top" });
    top.createDiv({ text: this.session.sourceName, cls: "rapid-reader-filename" });

    const topActions = top.createDiv({ cls: "rapid-reader-top-actions" });
    this.headerInfoEl = topActions.createDiv({ cls: "rapid-reader-header-info" });

    const helpBtn = topActions.createEl("button", { text: "HELP", cls: "rapid-reader-help-btn" });
    helpBtn.addEventListener("click", () => new RapidReaderHelpModal(this.app).open());

    const configBtn = topActions.createEl("button", { text: "Config", cls: "rapid-reader-help-btn" });
    configBtn.addEventListener("click", () => this.plugin.openSettingsTab());

    const body = root.createDiv({ cls: "rapid-reader-body" });
    const readerPane = body.createDiv({ cls: "rapid-reader-pane" });

    const guideTop = readerPane.createDiv({ cls: "rapid-reader-guide rapid-reader-guide-top" });
    const display = readerPane.createDiv({ cls: "rapid-reader-display" });
    const guideBottom = readerPane.createDiv({ cls: "rapid-reader-guide rapid-reader-guide-bottom" });
    if (!this.plugin.settings.showCenterGuide) {
      guideTop.hide();
      guideBottom.hide();
    }

    this.wordBeforeEl = display.createDiv({ cls: "rapid-reader-word rapid-reader-word-before" });
    const pivotCol = display.createDiv({ cls: "rapid-reader-orp-col" });
    this.wordOrpEl = pivotCol.createSpan({ cls: "rapid-reader-word-orp" });
    this.wordAfterEl = display.createDiv({ cls: "rapid-reader-word rapid-reader-word-after" });

    this.sidePanelEl = body.createDiv({ cls: "rapid-reader-side" });
    this.sidePanelEl.toggleClass("is-collapsed", !this.sidePanelOpen);

    const bottomBar = root.createDiv({ cls: "rapid-reader-bottom-bar" });
    const controls = bottomBar.createDiv({ cls: "rapid-reader-controls" });

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
    btn("Show/Hide text", () => {
      this.sidePanelOpen = !this.sidePanelOpen;
      this.sidePanelEl.toggleClass("is-collapsed", !this.sidePanelOpen);
    });

    const sliderRow = bottomBar.createDiv({ cls: "rapid-reader-slider-row" });
    const speedWrap = sliderRow.createDiv({ cls: "rapid-reader-slider-wrap" });
    this.speedEl = speedWrap.createEl("input", { type: "range", cls: "rapid-reader-progress" });
    this.speedEl.min = String(this.plugin.settings.minWpm);
    this.speedEl.max = String(this.plugin.getMaxWpm());
    this.speedEl.step = "25";
    this.speedEl.value = String(this.wpm);
    this.speedEl.addEventListener("input", () => this.setWpm(Number(this.speedEl.value)));

    this.speedInfoEl = speedWrap.createDiv({ cls: "rapid-reader-slider-label" });

    const progressWrap = sliderRow.createDiv({ cls: "rapid-reader-slider-wrap" });
    this.progressEl = progressWrap.createEl("input", { type: "range", cls: "rapid-reader-progress" });
    this.progressEl.min = "0";
    this.progressEl.max = String(Math.max(0, this.tokens.length - 1));
    this.progressEl.step = "1";
    this.progressEl.value = String(this.index);
    this.progressEl.addEventListener("input", () => this.jumpTo(Number(this.progressEl.value)));

    this.progressInfoEl = progressWrap.createDiv({ cls: "rapid-reader-slider-label" });

    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.isOpen()) return;
      const handled = this.handleKeydown(e);
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    this.modalEl.addEventListener("keydown", this.keyHandler, true);
  }

  private handleKeydown(e: KeyboardEvent): boolean {
    if (e.key === " " || e.code === "Space") return this.togglePlay(), true;
    if (e.key.toLowerCase() === "r") return this.jumpTo(0), true;
    if (e.key.toLowerCase() === "h") return new RapidReaderHelpModal(this.app).open(), true;
    if (e.key === ",") return this.plugin.openSettingsTab(), true;
    if (e.key === "ArrowLeft" && e.shiftKey) return this.move(-10), true;
    if (e.key === "ArrowRight" && e.shiftKey) return this.move(10), true;
    if (e.key === "ArrowLeft") return this.move(-1), true;
    if (e.key === "ArrowRight") return this.move(1), true;
    if (e.key === "ArrowUp") return this.setWpm(this.wpm + 25), true;
    if (e.key === "ArrowDown") return this.setWpm(this.wpm - 25), true;
    if (e.key === "[") return this.setWpm(this.wpm - 50), true;
    if (e.key === "]") return this.setWpm(this.wpm + 50), true;
    if (e.key === "Escape") return this.close(), true;
    return false;
  }

  private applyTheme(): void {
    const root = this.contentEl.querySelector(".rapid-reader-modal") as HTMLElement;
    root.style.setProperty("--rapid-reader-font-size", `${this.plugin.settings.fontSize}px`);
    root.style.setProperty("--rapid-reader-orp-color", this.plugin.settings.orpColor);
    if (this.plugin.settings.textColor) root.style.setProperty("--rapid-reader-text-color", this.plugin.settings.textColor);
    if (this.plugin.settings.backgroundColor) root.style.setProperty("--rapid-reader-bg-color", this.plugin.settings.backgroundColor);
    if (this.plugin.settings.fontFamily) root.style.setProperty("--rapid-reader-font-family", this.plugin.settings.fontFamily);
  }

  private renderCurrentWord(): void {
    const token = this.tokens[this.index];
    if (!token) {
      this.wordBeforeEl.setText("");
      this.wordOrpEl.setText("");
      this.wordAfterEl.setText("");
      return;
    }

    const parts = splitWordByOrp(token.text);
    this.wordBeforeEl.setText(parts.before);
    this.wordOrpEl.setText(parts.orp);
    this.wordAfterEl.setText(parts.after);
    this.updateWordScale(token.text);

    this.progressEl.value = String(this.index);
    this.updateHeader();
    this.highlightSideParagraph(token.paragraphIndex);

    if (this.plugin.settings.rememberPosition && this.session.sourcePath) {
      this.plugin.settings.progressByPath[this.session.sourcePath] = this.index;
      this.plugin.saveSettings();
    }
  }


  private updateWordScale(word: string): void {
    const root = this.contentEl.querySelector(".rapid-reader-modal") as HTMLElement | null;
    if (!root) return;

    const core = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    const length = Math.max(1, core.length);

    let factor = 1;
    if (length > 12) factor = Math.max(0.62, 12 / length);
    if (length > 20) factor = Math.max(0.5, 10 / length);

    root.style.setProperty("--rapid-reader-active-font-size", `calc(var(--rapid-reader-font-size) * ${factor.toFixed(3)})`);
  }

  private updateHeader(): void {
    const total = this.tokens.length;
    const current = Math.min(total, this.index + 1);
    const remaining = Math.max(0, total - current);
    const etaMs = estimateRemainingMs(remaining, this.wpm);
    const minutes = Math.floor(etaMs / 60000);
    const seconds = Math.floor((etaMs % 60000) / 1000);
    this.headerInfoEl.setText(`${this.wpm} WPM • ${current} / ${total} • ${minutes}:${String(seconds).padStart(2, "0")} remaining`);
    if (this.speedInfoEl) this.speedInfoEl.setText(`${this.wpm} w/min`);
    if (this.progressInfoEl) this.progressInfoEl.setText(`${current}/${total}`);
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
    if (this.index >= this.tokens.length - 1) {
      this.stop();
      return;
    }
    const previousToken = this.tokens[this.index];
    this.move(1);
    const displayedToken = this.tokens[this.index];
    const next = this.tokens[this.index + 1];
    const delay = calculateDelay(
      displayedToken,
      next,
      this.wpm,
      this.plugin.settings.punctuationPauseMultiplier,
      this.plugin.settings.sentencePauseMultiplier,
      this.plugin.settings.paragraphPauseMultiplier,
      previousToken
    );
    this.timeoutId = window.setTimeout(this.tick, delay);
  };

  private togglePlay(): void {
    if (this.playing) this.stop();
    else this.play();
  }

  private updatePlayPauseButton(): void {
    if (!this.playPauseBtn) return;
    this.playPauseBtn.empty();
    if (this.playing) {
      setIcon(this.playPauseBtn, "pause");
      this.playPauseBtn.setAttribute("aria-label", "Pause");
      this.playPauseBtn.setAttribute("title", "Pause");
    } else {
      setIcon(this.playPauseBtn, "play");
      this.playPauseBtn.setAttribute("aria-label", "Play");
      this.playPauseBtn.setAttribute("title", "Play");
    }
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

  private renderSidePanel(): void {
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
    const active = this.sideParagraphEls[paragraphIndex];
    if (active && this.sidePanelOpen) {
      active.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
}
