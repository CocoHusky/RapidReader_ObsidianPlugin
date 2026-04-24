import { App, PluginSettingTab, Setting } from "obsidian";
import type RapidReaderPlugin from "./main";
import { RapidReaderSettings } from "./types";

export const DEFAULT_SETTINGS: RapidReaderSettings = {
  defaultWpm: 500,
  minWpm: 100,
  maxWpmMode: "normal",
  fontSize: 48,
  fontFamily: "",
  orpColor: "#ff4d4f",
  textColor: "",
  backgroundColor: "",
  readerWidth: 1600,
  fullWidthModal: false,
  showCenterGuide: true,
  showSidePanelDefault: true,
  punctuationPauseMultiplier: 1.2,
  sentencePauseMultiplier: 1.8,
  paragraphPauseMultiplier: 2.2,
  replaceCodeBlocks: true,
  replaceInlineCode: true,
  replaceUrlsOnSimplify: true,
  autoplay: false,
  rememberPosition: true,
  warnLowReadability: true,
  lastWpm: 500,
  progressByPath: {},
  sidePanelOpenByDefault: true,
  cleanupLinks: true,
  cleanupSymbols: true,
  splitHyphenatedWords: true,
  stripNumericCitations: true
};

export class RapidReaderSettingTab extends PluginSettingTab {
  plugin: RapidReaderPlugin;

  constructor(app: App, plugin: RapidReaderPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Rapid Reader settings" });

    const toClampedInt = (value: string, min: number, max: number, fallback: number): number => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.max(min, Math.min(max, parsed));
    };

    const toClampedFloat = (value: string, min: number, max: number, fallback: number): number => {
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.max(min, Math.min(max, parsed));
    };

    new Setting(containerEl).setName("Default WPM").setDesc("Range: 100 to 1200 (step 25).").addText((t) => t.setPlaceholder("500").setValue(String(this.plugin.settings.defaultWpm)).onChange(async (value) => {
      const clamped = toClampedInt(value, 100, 1200, this.plugin.settings.defaultWpm);
      this.plugin.settings.defaultWpm = clamped;
      this.plugin.settings.lastWpm = clamped;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Minimum WPM").setDesc("Range: 50 to 600.").addText((t) => t.setValue(String(this.plugin.settings.minWpm)).onChange(async (value) => {
      this.plugin.settings.minWpm = toClampedInt(value, 50, 600, this.plugin.settings.minWpm);
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Maximum WPM mode").addDropdown((d) => d.addOption("normal", "Normal (1200)").addOption("advanced", "Advanced (2000)").setValue(this.plugin.settings.maxWpmMode).onChange(async (value: "normal" | "advanced") => {
      this.plugin.settings.maxWpmMode = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Reader font size").setDesc("Range: 24 to 96 px.").addText((t) => t.setPlaceholder("48").setValue(String(this.plugin.settings.fontSize)).onChange(async (value) => {
      this.plugin.settings.fontSize = toClampedInt(value, 24, 96, this.plugin.settings.fontSize);
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Font family").setDesc("Leave empty to use Obsidian/theme default.").addText((t) => t.setPlaceholder("Theme default").setValue(this.plugin.settings.fontFamily).onChange(async (value) => {
      this.plugin.settings.fontFamily = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("ORP color").addColorPicker((cp) => cp.setValue(this.plugin.settings.orpColor).onChange(async (value) => {
      this.plugin.settings.orpColor = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Text color override").addText((t) => t.setPlaceholder("Theme default").setValue(this.plugin.settings.textColor).onChange(async (value) => {
      this.plugin.settings.textColor = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Background color override").addText((t) => t.setPlaceholder("Theme default").setValue(this.plugin.settings.backgroundColor).onChange(async (value) => {
      this.plugin.settings.backgroundColor = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Reader width (px)").setDesc("Range: 900 to 2200 px.").addText((t) => t.setValue(String(this.plugin.settings.readerWidth)).onChange(async (value) => {
      this.plugin.settings.readerWidth = toClampedInt(value, 900, 2200, this.plugin.settings.readerWidth);
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Use wide reader modal").setDesc("Enable a larger modal layout for big screens.").addToggle((tg) => tg.setValue(this.plugin.settings.fullWidthModal).onChange(async (value) => {
      this.plugin.settings.fullWidthModal = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Show center guide").addToggle((tg) => tg.setValue(this.plugin.settings.showCenterGuide).onChange(async (value) => {
      this.plugin.settings.showCenterGuide = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Show side panel by default").addToggle((tg) => tg.setValue(this.plugin.settings.showSidePanelDefault).onChange(async (value) => {
      this.plugin.settings.showSidePanelDefault = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Punctuation pause multiplier").setDesc("Quantitative value. Range: 1 to 100. Used for commas, colons, semicolons, and decimal numbers like 2.3.").addText((t) => t.setPlaceholder("1.2").setValue(String(this.plugin.settings.punctuationPauseMultiplier)).onChange(async (value) => {
      this.plugin.settings.punctuationPauseMultiplier = toClampedFloat(value, 1, 100, this.plugin.settings.punctuationPauseMultiplier);
      await this.plugin.saveSettings();
    }));


    new Setting(containerEl).setName("Sentence pause multiplier").setDesc("Quantitative value. Range: 1 to 100. Applied after sentence-ending punctuation (. ! ?).").addText((t) => t.setPlaceholder("1.8").setValue(String(this.plugin.settings.sentencePauseMultiplier)).onChange(async (value) => {
      this.plugin.settings.sentencePauseMultiplier = toClampedFloat(value, 1, 100, this.plugin.settings.sentencePauseMultiplier);
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Paragraph pause multiplier").setDesc("Quantitative value. Range: 1 to 100. Applied at paragraph boundaries.").addText((t) => t.setPlaceholder("2.2").setValue(String(this.plugin.settings.paragraphPauseMultiplier)).onChange(async (value) => {
      this.plugin.settings.paragraphPauseMultiplier = toClampedFloat(value, 1, 100, this.plugin.settings.paragraphPauseMultiplier);
      await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName("Replace code blocks").addToggle((tg) => tg.setValue(this.plugin.settings.replaceCodeBlocks).onChange(async (value) => {
      this.plugin.settings.replaceCodeBlocks = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Replace inline code").addToggle((tg) => tg.setValue(this.plugin.settings.replaceInlineCode).onChange(async (value) => {
      this.plugin.settings.replaceInlineCode = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Replace URLs during simplify").addToggle((tg) => tg.setValue(this.plugin.settings.replaceUrlsOnSimplify).onChange(async (value) => {
      this.plugin.settings.replaceUrlsOnSimplify = value;
      await this.plugin.saveSettings();
    }));


    new Setting(containerEl).setName("Remove links in reader").setDesc("Drop URLs and DOI links from displayed/read tokens.").addToggle((tg) => tg.setValue(this.plugin.settings.cleanupLinks).onChange(async (value) => {
      this.plugin.settings.cleanupLinks = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Remove noisy symbols").setDesc("Remove quote/paren/tilde/backtick-style noise during reading cleanup.").addToggle((tg) => tg.setValue(this.plugin.settings.cleanupSymbols).onChange(async (value) => {
      this.plugin.settings.cleanupSymbols = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Split hyphenated words").setDesc("Example: macro-electrodes → macro electrodes.").addToggle((tg) => tg.setValue(this.plugin.settings.splitHyphenatedWords).onChange(async (value) => {
      this.plugin.settings.splitHyphenatedWords = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Strip numeric citations").setDesc("Remove citation markers like [17] and linked [17](url)." ).addToggle((tg) => tg.setValue(this.plugin.settings.stripNumericCitations).onChange(async (value) => {
      this.plugin.settings.stripNumericCitations = value;
      await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName("Autoplay after preflight").addToggle((tg) => tg.setValue(this.plugin.settings.autoplay).onChange(async (value) => {
      this.plugin.settings.autoplay = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Remember position by file").addToggle((tg) => tg.setValue(this.plugin.settings.rememberPosition).onChange(async (value) => {
      this.plugin.settings.rememberPosition = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Warn before low-readability docs").addToggle((tg) => tg.setValue(this.plugin.settings.warnLowReadability).onChange(async (value) => {
      this.plugin.settings.warnLowReadability = value;
      await this.plugin.saveSettings();
    }));
  }
}
