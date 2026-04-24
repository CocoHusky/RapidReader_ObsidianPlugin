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
  showCenterGuide: true,
  showSidePanelDefault: true,
  punctuationPause: "normal",
  replaceCodeBlocks: true,
  replaceInlineCode: true,
  replaceUrlsOnSimplify: true,
  autoplay: false,
  rememberPosition: true,
  warnLowReadability: true,
  lastWpm: 500,
  progressByPath: {},
  sidePanelOpenByDefault: true
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

    new Setting(containerEl).setName("Default WPM").addSlider((s) => s.setLimits(100, 1200, 25).setValue(this.plugin.settings.defaultWpm).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.defaultWpm = value;
      this.plugin.settings.lastWpm = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Minimum WPM").addText((t) => t.setValue(String(this.plugin.settings.minWpm)).onChange(async (value) => {
      this.plugin.settings.minWpm = Math.max(50, Number(value) || 100);
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Maximum WPM mode").addDropdown((d) => d.addOption("normal", "Normal (1200)").addOption("advanced", "Advanced (2000)").setValue(this.plugin.settings.maxWpmMode).onChange(async (value: "normal" | "advanced") => {
      this.plugin.settings.maxWpmMode = value;
      await this.plugin.saveSettings();
    }));

    new Setting(containerEl).setName("Reader font size").addSlider((s) => s.setLimits(24, 96, 1).setValue(this.plugin.settings.fontSize).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.fontSize = value;
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

    new Setting(containerEl).setName("Reader width (px)").addText((t) => t.setValue(String(this.plugin.settings.readerWidth)).onChange(async (value) => {
      this.plugin.settings.readerWidth = Math.max(900, Number(value) || 1600);
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

    new Setting(containerEl).setName("Punctuation pause").addDropdown((d) => d.addOption("off", "Off").addOption("light", "Light").addOption("normal", "Normal").addOption("strong", "Strong").setValue(this.plugin.settings.punctuationPause).onChange(async (value: any) => {
      this.plugin.settings.punctuationPause = value;
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
