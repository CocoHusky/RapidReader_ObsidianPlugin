import { Modal, Notice, setIcon } from "obsidian";
import type RapidReaderPlugin from "./main";
import { splitWordByOrp } from "./orp";
import { calculateDelay, estimateRemainingMs } from "./timing";
import { ReaderToken } from "./types";

interface ReaderSession {
  sourceName: string;
  sourcePath: string;
  text: string;
  simplifiedText: string;
  useSimplified: boolean;
  tokens: ReaderToken[];
  simplifiedTokens: ReaderToken[];
  initialIndex: number;
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
    this.contentEl.empty();
    this.buildLayout();
    this.renderSidePanel();
    this.renderCurrentWord();
    this.applyTheme();
    if (this.plugin.settings.autoplay) this.play();
  }

  onClose(): void {
    this.stop();
    if (this.keyHandler) window.removeEventListener("keydown", this.keyHandler, true);
    this.contentEl.empty();
  }

  private buildLayout(): void {
    const root = this.contentEl.createDiv({ cls: "rapid-reader-modal" });
    root.style.maxWidth = `${this.plugin.settings.readerWidth}px`;

    const top = root.createDiv({ cls: "rapid-reader-top" });
    top.createDiv({ text: this.session.sourceName, cls: "rapid-reader-filename" });
    this.headerInfoEl = top.createDiv({ cls: "rapid-reader-header-info" });

    const body = root.createDiv({ cls: "rapid-reader-body" });
    const readerPane = body.createDiv({ cls: "rapid-reader-pane" });

    const guideTop = readerPane.createDiv({ cls: "rapid-reader-guide rapid-reader-guide-top" });
    const display = readerPane.createDiv({ cls: "rapid-reader-display" });
    const guideBottom = readerPane.createDiv({ cls: "rapid-reader-guide rapid-reader-guide-bottom" });
    if (!this.plugin.settings.showCenterGuide) {
      guideTop.hide();
      guideBottom.hide();
    }

    const before = display.createDiv({ cls: "rapid-reader-word rapid-reader-word-before" });
    const pivotCol = display.createDiv({ cls: "rapid-reader-orp-col" });
    const after = display.createDiv({ cls: "rapid-reader-word rapid-reader-word-after" });

    this.wordBeforeEl = before;
    this.wordOrpEl = pivotCol.createSpan({ cls: "rapid-reader-word-orp" });
    this.wordAfterEl = after;

    this.sidePanelEl = body.createDiv({ cls: "rapid-reader-side" });
    this.sidePanelEl.toggleClass("is-collapsed", !this.sidePanelOpen);

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
    const playBtn = btn("Play/Pause", () => this.togglePlay(), "play");
    btn("Next", () => this.move(1));
    btn("Forward 10", () => this.move(10));

    const sideToggle = btn("Show/Hide text", () => {
      this.sidePanelOpen = !this.sidePanelOpen;
      this.sidePanelEl.toggleClass("is-collapsed", !this.sidePanelOpen);
    });

    this.speedEl = controls.createEl("input", { type: "range" });
    this.speedEl.min = String(this.plugin.settings.minWpm);
    this.speedEl.max = String(this.plugin.getMaxWpm());
    this.speedEl.step = "25";
    this.speedEl.value = String(this.wpm);
    this.speedEl.addEventListener("input", () => this.setWpm(Number(this.speedEl.value)));

    this.progressEl = controls.createEl("input", { type: "range", cls: "rapid-reader-progress" });
    this.progressEl.min = "0";
    this.progressEl.max = String(Math.max(0, this.tokens.length - 1));
    this.progressEl.step = "1";
    this.progressEl.value = String(this.index);
    this.progressEl.addEventListener("input", () => this.jumpTo(Number(this.progressEl.value)));

    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.isOpen()) return;
      const handled = this.handleKeydown(e, playBtn, sideToggle);
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", this.keyHandler, true);
  }

  private handleKeydown(e: KeyboardEvent, _playBtn: HTMLElement, _toggleBtn: HTMLElement): boolean {
    if (e.key === " ") return this.togglePlay(), true;
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

    this.progressEl.value = String(this.index);
    this.updateHeader();
    this.highlightSideParagraph(token.paragraphIndex);

    if (this.plugin.settings.rememberPosition && this.session.sourcePath) {
      this.plugin.settings.progressByPath[this.session.sourcePath] = this.index;
      this.plugin.saveSettings();
    }
  }

  private updateHeader(): void {
    const total = this.tokens.length;
    const current = Math.min(total, this.index + 1);
    const remaining = Math.max(0, total - current);
    const etaMs = estimateRemainingMs(remaining, this.wpm);
    const minutes = Math.floor(etaMs / 60000);
    const seconds = Math.floor((etaMs % 60000) / 1000);
    this.headerInfoEl.setText(`${this.wpm} WPM • ${current} / ${total} • ${minutes}:${String(seconds).padStart(2, "0")} remaining`);
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

  private play(): void {
    if (!this.tokens.length) {
      new Notice("No readable tokens found.");
      return;
    }
    this.stop();
    this.playing = true;
    this.timeoutId = window.setTimeout(this.tick, 60000 / this.wpm);
  }

  private stop(): void {
    this.playing = false;
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
