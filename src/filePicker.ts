import { App, Notice, SuggestModal, TFile } from "obsidian";

function isSupportedName(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".txt")) return true;
  return /^readme(\.[^./\\]+)?$/i.test(name);
}

export function isSupportedFile(file: TFile): boolean {
  if (file.extension === "md" || file.extension === "txt") return true;
  return isSupportedName(file.name);
}

export class RapidReaderFileSuggestModal extends SuggestModal<TFile> {
  private readonly files: TFile[];
  private readonly onChoose: (file: TFile) => void;

  constructor(app: App, onChoose: (file: TFile) => void) {
    super(app);
    this.files = app.vault.getFiles().filter(isSupportedFile);
    this.onChoose = onChoose;
    this.setPlaceholder("Choose a Markdown or text file for Rapid Reader...");
  }

  getSuggestions(query: string): TFile[] {
    const normalized = query.toLowerCase();
    return this.files
      .filter((file) => file.path.toLowerCase().includes(normalized))
      .slice(0, 100);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createEl("div", { text: file.basename });
    el.createEl("small", { text: file.path, cls: "rapid-reader-muted" });
  }

  onChooseSuggestion(file: TFile): void {
    if (!isSupportedFile(file)) {
      new Notice("Rapid Reader only supports Markdown and text files in this version.");
      return;
    }
    this.onChoose(file);
  }
}
