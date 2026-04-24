import { App, MarkdownView, Modal, Notice, Plugin } from "obsidian";
import { RapidReaderFileSuggestModal, isSupportedFile } from "./filePicker";
import { RapidReaderModal } from "./readerModal";
import { DEFAULT_SETTINGS, RapidReaderSettingTab } from "./settings";
import { analyzeReadability, cleanMarkdownText, simplifyText, tokenizeText } from "./textProcessing";
import { RapidReaderSettings } from "./types";

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

export default class RapidReaderPlugin extends Plugin {
  settings: RapidReaderSettings;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.addRibbonIcon("book-open", "Open Rapid Reader", () => this.openForCurrentFile());

    this.addCommand({
      id: "rapid-reader-open-current",
      name: "Open Rapid Reader for current file",
      callback: () => this.openForCurrentFile()
    });

    this.addCommand({
      id: "rapid-reader-pick-file",
      name: "Choose file for Rapid Reader",
      callback: () => {
        new RapidReaderFileSuggestModal(this.app, async (file) => {
          const rawText = await this.app.vault.read(file);
          this.openFromText({ path: file.path, name: file.name, rawText });
        }).open();
      }
    });

    this.addCommand({
      id: "rapid-reader-open-settings",
      name: "Open Rapid Reader settings",
      callback: () => this.app.setting.openTabById(this.manifest.id)
    });

    this.addSettingTab(new RapidReaderSettingTab(this.app, this));
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
      new RapidReaderModal(this, {
        sourceName: source.name,
        sourcePath: source.path,
        text: cleanedText,
        simplifiedText: simplified,
        useSimplified,
        tokens,
        simplifiedTokens,
        initialIndex: remembered
      }).open();
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
