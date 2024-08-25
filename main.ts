import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, EditorSuggest, EditorPosition, EditorSuggestTriggerInfo, EditorSuggestContext } from 'obsidian';
import { questions } from './questions_en';

interface PermaPluginSettings {
	resultTemplate: string;
	fileNamingConvention: string;
	defaultSaveLocation: string;
	showRibbonIcon: boolean;
}

class FileSuggest extends EditorSuggest<string> {
    plugin: PermaPlugin;
    inputEl: HTMLTextAreaElement;
    suggestEl: HTMLElement | null;
    suggestions: string[] = [];

    constructor(plugin: PermaPlugin) {
        super(plugin.app);
        this.plugin = plugin;
    }

    onTrigger(cursor: EditorPosition, editor: Editor, file: TFile): EditorSuggestTriggerInfo | null {
        const substr = editor.getLine(cursor.line).substring(0, cursor.ch);
        const match = substr.match(/\[\[([^\]]+)$/);

        if (match) {
            return {
                start: { line: cursor.line, ch: match.index! },
                end: cursor,
                query: match[1]
            };
        }
        return null;
    }

    getSuggestions(context: EditorSuggestContext): string[] {
        const files = this.plugin.app.vault.getFiles();
        const query = context.query.toLowerCase();
        return files
            .filter(file => file.path.toLowerCase().contains(query))
            .map(file => file.path);
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    }

    selectSuggestion(value: string): void {
        const { editor } = this.context!;
        editor.replaceRange(`${value}]]`, this.context!.start, this.context!.end);
    }

    attachEditor(editor: HTMLTextAreaElement): void {
        this.inputEl = editor;
        this.suggestEl = editor.parentElement?.createDiv('suggestion-container');
        this.scope.register([], 'Enter', (evt: KeyboardEvent) => {
            if (this.suggestions.length > 0) {
                evt.preventDefault();
                this.selectSuggestion(this.suggestions[0]);
            }
        });
    }
}

const DEFAULT_SETTINGS: Partial<PermaPluginSettings> = {
	resultTemplate: '# PERMA Profiler Results\n\nDate: {{date}}\n\n## Scores\n\nPositive Emotion: {{score_P}}\nEngagement: {{score_E}}\nRelationships: {{score_R}}\nMeaning: {{score_M}}\nAccomplishment: {{score_A}}\n\n## Interpretations\n\n{{interpretations}}',
	fileNamingConvention: 'PERMA-Results-{{date}}',
	defaultSaveLocation: '/',
	showRibbonIcon: true
};

export default class PermaPlugin extends Plugin {
	settings: PermaPluginSettings;

	async onload() {
		// Add this line at the beginning of the onload method
		(this.app as any).plugins.plugins['perma-profiler'] = this;
		await this.loadSettings();

		// Add ribbon icon
		if (this.settings.showRibbonIcon) {
			const ribbonIconEl = this.addRibbonIcon('clipboard-list', 'PERMA Profiler', (evt: MouseEvent) => {
				new PermaTestModal(this.app, this).open();
			});
			ribbonIconEl.addClass('perma-profiler-ribbon-class');
		}

		// Add command to start the PERMA Profiler test
		this.addCommand({
			id: 'start-perma-test',
			name: 'Start PERMA Profiler Test',
			callback: () => {
				new PermaTestModal(this.app, this).open();
			}
		});

		// Add settings tab
		this.addSettingTab(new PermaSettingTab(this.app, this));
	}

	onunload() {
		// Clean up resources if needed
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class PermaTestModal extends Modal {
	private currentQuestion: number = 0;
	private answers: Map<number, { score: number; reflection: string }> = new Map();
	private questions: string[];
	private plugin: PermaPlugin;
	private fileSuggest: FileSuggest;

	constructor(app: App, plugin: PermaPlugin) {
		super(app);
		this.questions = questions;
		this.plugin = plugin;
		this.fileSuggest = new FileSuggest(plugin);
		plugin.registerEditorSuggest(this.fileSuggest);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl('h2', {text: 'PERMA Profiler Test'});
		this.displayQuestion();
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}

	private displayQuestion() {
		const {contentEl} = this;
		contentEl.empty();

		const questionEl = contentEl.createEl('div', {cls: 'perma-question'});
		questionEl.createEl('p', {text: this.questions[this.currentQuestion]});

		new Setting(contentEl)
			.setName('Your answer')
			.setDesc('0 = Never, 10 = Always')
			.addSlider(slider => slider
				.setLimits(0, 10, 1)
				.setValue(this.answers.get(this.currentQuestion)?.score ?? 5)
				.setDynamicTooltip()
				.onChange(value => {
					const currentAnswer = this.answers.get(this.currentQuestion) ?? { score: 5, reflection: '' };
					this.answers.set(this.currentQuestion, { ...currentAnswer, score: value });
				}));

		// Add comment textarea with file suggest functionality
		const commentSetting = new Setting(contentEl)
			.setName('Reflections')
			.setDesc('Add any thoughts or reflections on this question');

		const commentTextarea = commentSetting.controlEl.createEl('textarea', {
			cls: 'perma-comment',
			attr: {rows: '4', cols: '50'}
		});

		commentTextarea.addEventListener('input', (event) => {
			const currentAnswer = this.answers.get(this.currentQuestion) ?? { score: 5, reflection: '' };
			this.answers.set(this.currentQuestion, { ...currentAnswer, reflection: (event.target as HTMLTextAreaElement).value });
		});

		// Enable file suggest functionality
		this.fileSuggest.attachEditor(commentTextarea);

		// Update the answer when the textarea changes
		commentTextarea.addEventListener('input', (event) => {
			const currentAnswer = this.answers.get(this.currentQuestion) ?? { score: 5, reflection: '' };
			this.answers.set(this.currentQuestion, { ...currentAnswer, reflection: (event.target as HTMLTextAreaElement).value });
		});

		// Register the FileSuggest with the Editor
		this.plugin.registerEditorSuggest(this.fileSuggest);

		const navigationEl = contentEl.createEl('div', {cls: 'perma-navigation'});
		
		// Always create a left-side button container
		const leftButtonContainer = navigationEl.createEl('div');
		
		// Always create a right-side button container
		const rightButtonContainer = navigationEl.createEl('div');

		if (this.currentQuestion > 0) {
			leftButtonContainer.createEl('button', {text: 'Previous'}).onclick = () => this.previousQuestion();
		}
		
		if (this.currentQuestion < this.questions.length - 1) {
			rightButtonContainer.createEl('button', {text: 'Next'}).onclick = () => this.nextQuestion();
		} else {
			rightButtonContainer.createEl('button', {text: 'Finish'}).onclick = () => this.finishTest();
		}

		contentEl.createEl('div', {cls: 'perma-progress', text: `Question ${this.currentQuestion + 1} of ${this.questions.length}`});
	}

	private nextQuestion() {
		if (this.currentQuestion < this.questions.length - 1) {
			this.currentQuestion++;
			this.displayQuestion();
		}
	}

	private previousQuestion() {
		if (this.currentQuestion > 0) {
			this.currentQuestion--;
			this.displayQuestion();
		}
	}

	private async finishTest() {
		// Calculate scores
		const scores = this.calculateScores();
		
		// Generate result content
		const content = this.generateResultContent(scores);
		
		// Create and open the new note
		const fileName = this.generateFileName();
		const file = await this.createResultNote(fileName, content);
		
		// Open the newly created note
		if (file instanceof TFile) {
			this.app.workspace.getLeaf().openFile(file);
		}
		
		new Notice('Test completed! Results have been generated and opened.');
		this.close();
	}

	private calculateScores() {
		// TODO: Implement actual scoring logic
		return {
			P: 5, E: 5, R: 5, M: 5, A: 5
		};
	}

	private generateResultContent(scores: Record<string, number>) {
		const plugin = this.plugin;
		let content = plugin.settings.resultTemplate;
		
		const date = new Date().toISOString().split('T')[0];
		content = content.replace('{{date}}', date);
		
		for (const [key, value] of Object.entries(scores)) {
			content = content.replace(`{{score_${key}}}`, value.toString());
		}
		
		// Generate interpretations (placeholder)
		content = content.replace('{{interpretations}}', 'Interpretations to be implemented.');
		
		// Add questions and reflections
		let questionsAndReflections = '## Questions and Reflections\n\n';
		this.answers.forEach((answer, index) => {
			questionsAndReflections += `### Question ${index + 1}: ${this.questions[index]}\n`;
			questionsAndReflections += `Score: ${answer.score}\n`;
			questionsAndReflections += `Reflection: ${answer.reflection || 'No reflection provided'}\n\n`;
		});
		
		content += '\n\n' + questionsAndReflections;
		
		return content;
	}

	private generateFileName() {
		const plugin = this.plugin;
		const date = new Date().toISOString().split('T')[0];
		return plugin.settings.fileNamingConvention.replace('{{date}}', date) + '.md';
	}

	private async createResultNote(fileName: string, content: string) {
		const plugin = this.plugin;
		const path = `${plugin.settings.defaultSaveLocation}/${fileName}`;
		let file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			// File exists, overwrite its content
			await this.app.vault.modify(file, content);
		} else {
			// File doesn't exist, create a new one
			file = await this.app.vault.create(path, content);
		}
		return file;
	}
}

class PermaSettingTab extends PluginSettingTab {
	plugin: PermaPlugin;

	constructor(app: App, plugin: PermaPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'PERMA Profiler Settings'});

		new Setting(containerEl)
			.setName('Result Template')
			.setDesc('Template for generating result notes')
			.addTextArea(text => text
				.setPlaceholder('Enter your template')
				.setValue(this.plugin.settings.resultTemplate)
				.onChange(async (value) => {
					this.plugin.settings.resultTemplate = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('File Naming Convention')
			.setDesc('Convention for naming result files')
			.addText(text => text
				.setPlaceholder('Enter file naming convention')
				.setValue(this.plugin.settings.fileNamingConvention)
				.onChange(async (value) => {
					this.plugin.settings.fileNamingConvention = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Save Location')
			.setDesc('Default location to save result notes')
			.addText(text => text
				.setPlaceholder('Enter default save location')
				.setValue(this.plugin.settings.defaultSaveLocation)
				.onChange(async (value) => {
					this.plugin.settings.defaultSaveLocation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show Ribbon Icon')
			.setDesc('Toggle visibility of the ribbon icon')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showRibbonIcon)
				.onChange(async (value) => {
					this.plugin.settings.showRibbonIcon = value;
					await this.plugin.saveSettings();
				}));
	}
}
