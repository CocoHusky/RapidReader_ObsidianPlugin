import { App, MarkdownView, Modal, Notice, Plugin } from "obsidian";
import { RapidReaderFileSuggestModal, isSupportedFile } from "./filePicker";
import { ReaderSession, RapidReaderSettings } from "./types";
import { DEFAULT_SETTINGS, RapidReaderSettingTab } from "./settings";
import { analyzeReadability, cleanMarkdownText, simplifyText, tokenizeText } from "./textProcessing";
import { RAPID_READER_DOCKED_VIEW, RapidReaderDockedView } from "./dockedView";

interface SourcePayload {
  path: string;
  name: string;
  rawText: string;
}

class PreflightModal extends Modal {
  constructor(
    app: App,
    private readonly issues: string[],
    private readonly onDecision: (decision: "simplify" | "continue" | "cancel") => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "This document may not read smoothly" });
    this.contentEl.createEl("p", { text: "Rapid Reader detected structure that may reduce readability." });
    const ul = this.contentEl.createEl("ul");
    this.issues.forEach((issue) => ul.createEl("li", { text: issue }));

    const buttons = this.contentEl.createDiv({ cls: "rapid-reader-preflight-buttons" });
    const mk = (label: string, d: "simplify" | "continue" | "cancel") => {
      const b = buttons.createEl("button", { text: label });
      b.addEventListener("click", () => {
        this.close();
        this.onDecision(d);
      });
    };

    mk("Simplify", "simplify");
    mk("Continue", "continue");
    mk("Cancel", "cancel");
  }
}

class RibbonActionModal extends Modal {
  constructor(app: App, private readonly onCurrent: () => void, private readonly onChoose: () => void) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h3", { text: "Rapid Reader" });
    this.contentEl.createEl("p", { text: "Choose how you want to open Rapid Reader." });

    const actions = this.contentEl.createDiv({ cls: "rapid-reader-preflight-buttons" });
    const currentBtn = actions.createEl("button", { text: "Open current file" });
    const browseBtn = actions.createEl("button", { text: "Choose another file" });

    currentBtn.addEventListener("click", () => {
      this.close();
      this.onCurrent();
    });

    browseBtn.addEventListener("click", () => {
      this.close();
      this.onChoose();
    });
  }
}

export default class RapidReaderPlugin extends Plugin {
  settings: RapidReaderSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(RAPID_READER_DOCKED_VIEW, (leaf) => new RapidReaderDockedView(leaf, this));

    this.addRibbonIcon("book-open", "Open Rapid Reader", () => {
      new RibbonActionModal(this.app, () => this.openForCurrentFile(), () => this.openFilePicker()).open();
    });

    this.addCommand({
      id: "rapid-reader-open-current",
      name: "Open Rapid Reader for current file",
      callback: () => this.openForCurrentFile()
    });

    this.addCommand({
      id: "rapid-reader-pick-file",
      name: "Choose file for Rapid Reader",
      callback: () => this.openFilePicker()
    });

    this.addCommand({
      id: "rapid-reader-open-settings",
      name: "Open Rapid Reader settings",
      callback: () => this.app.setting.openTabById(this.manifest.id)
    });

    this.addSettingTab(new RapidReaderSettingTab(this.app, this));
  }

  async onunload(): Promise<void> {
    this.app.workspace.getLeavesOfType(RAPID_READER_DOCKED_VIEW).forEach((leaf) => leaf.detach());
  }

  getMaxWpm(): number {
    return this.settings.maxWpmMode === "advanced" ? 2000 : 1200;
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.lastWpm) this.settings.lastWpm = this.settings.defaultWpm;
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  openFilePicker(): void {
    new RapidReaderFileSuggestModal(this.app, async (file) => {
      const rawText = await this.app.vault.read(file);
      this.openFromText({ path: file.path, name: file.name, rawText });
    }).open();
  }

  async openForCurrentFile(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice("No active file found.");
      return;
    }

    if (!isSupportedFile(activeFile)) {
      new Notice("Rapid Reader only supports Markdown and text files in this version.");
      return;
    }

    const selected = this.getSelectedEditorText();
    if (selected?.trim()) {
      await this.openFromText({
        path: activeFile.path,
        name: `${activeFile.name} (selection)`,
        rawText: selected
      });
      return;
    }

    const rawText = await this.app.vault.read(activeFile);
    await this.openFromText({ path: activeFile.path, name: activeFile.name, rawText });
  }

  openPreparedSession(session: ReaderSession): void {
    this.openInTabView(session);
  }

  private async openInTabView(session: ReaderSession): Promise<void> {
    const leaf = this.app.workspace.getLeaf("tab");
    if (!leaf) return;
    await leaf.setViewState({ type: RAPID_READER_DOCKED_VIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (view instanceof RapidReaderDockedView) {
      view.setSession(session);
    }
  }

  private getSelectedEditorText(): string | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return null;
    const selection = view.editor?.getSelection?.() ?? "";
    return selection.trim().length > 0 ? selection : null;
  }

  async openFromText(source: SourcePayload): Promise<void> {
    const cleanedText = cleanMarkdownText(source.rawText, this.settings);
    const simplified = simplifyText(source.rawText, this.settings);
    const analysis = analyzeReadability(source.rawText);
    const tokens = tokenizeText(cleanedText);
    const simplifiedTokens = tokenizeText(simplified);

    if (!tokens.length) {
      new Notice("No readable text found for Rapid Reader.");
      return;
    }

    const openReader = (useSimplified: boolean) => {
      const remembered = this.settings.rememberPosition ? this.settings.progressByPath[source.path] ?? 0 : 0;
      this.openPreparedSession({
        sourceName: source.name,
        sourcePath: source.path,
        text: cleanedText,
        simplifiedText: simplified,
        useSimplified,
        tokens,
        simplifiedTokens,
        initialIndex: remembered
      });
    };

    if (this.settings.warnLowReadability && analysis.shouldWarn) {
      new PreflightModal(this.app, analysis.issues, (decision) => {
        if (decision === "cancel") return;
        openReader(decision === "simplify");
      }).open();
      return;
    }

    openReader(false);
  }
}
