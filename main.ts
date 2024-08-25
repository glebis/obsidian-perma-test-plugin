import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, EditorSuggest, EditorPosition, EditorSuggestTriggerInfo, EditorSuggestContext } from 'obsidian';
import { questions, Question } from './questions_en';

interface PermaPluginSettings {
	resultTemplate: string;
	fileNamingConvention: string;
	defaultSaveLocation: string;
	showRibbonIcon: boolean;
}

class FileSuggest extends EditorSuggest<TFile> {
    plugin: PermaPlugin;

    constructor(plugin: PermaPlugin) {
        super(plugin.app);
        this.plugin = plugin;
    }

    onTrigger(cursor: EditorPosition, editor: Editor): EditorSuggestTriggerInfo | null {
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

    getSuggestions(context: EditorSuggestContext): TFile[] {
        const files = this.app.vault.getMarkdownFiles();
        const query = context.query.toLowerCase();
        return files.filter(file => 
            file.path.toLowerCase().contains(query) ||
            file.basename.toLowerCase().contains(query)
        );
    }

    renderSuggestion(file: TFile, el: HTMLElement): void {
        el.createEl("div", { text: file.basename });
        el.createEl("small", { text: file.path });
    }

    selectSuggestion(file: TFile): void {
        if (this.context) {
            this.context.editor.replaceRange(
                `[[${file.path}]]`,
                this.context.start,
                this.context.end
            );
        }
    }
}

const DEFAULT_SETTINGS: Partial<PermaPluginSettings> = {
	resultTemplate: '# PERMA Profiler Results\n\nDate: {{date}}\n\n## Scores and Interpretations\n\n{{interpretations}}\n\n## Overall Reflection\n\n[Your overall reflection on the PERMA test results goes here]',
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
	private answers: Map<string, { score: number; reflection: string }> = new Map();
	private questions: Question[];
	private plugin: PermaPlugin;
	private fileSuggest: FileSuggest;

	constructor(app: App, plugin: PermaPlugin) {
		super(app);
		this.questions = questions;
		this.plugin = plugin;
		this.fileSuggest = new FileSuggest(plugin);
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

		const question = this.questions[this.currentQuestion];
		const questionEl = contentEl.createEl('div', {cls: 'perma-question'});
		questionEl.createEl('p', {text: question.text});

		new Setting(contentEl)
			.setName('Your answer')
			.setDesc(`${question.scale.minLabel} = ${question.scale.min}, ${question.scale.maxLabel} = ${question.scale.max}`)
			.addSlider(slider => slider
				.setLimits(question.scale.min, question.scale.max, 1)
				.setValue(this.answers.get(question.id)?.score ?? (question.scale.max - question.scale.min) / 2)
				.setDynamicTooltip()
				.onChange(value => {
					const currentAnswer = this.answers.get(question.id) ?? { score: (question.scale.max - question.scale.min) / 2, reflection: '' };
					this.answers.set(question.id, { ...currentAnswer, score: value });
				}));

		// Add comment textarea with file suggest functionality
		const commentSetting = new Setting(contentEl)
			.setName('Reflections')
			.setDesc('Add any thoughts or reflections on this question');

		const commentTextarea = commentSetting.controlEl.createEl('textarea', {
			cls: 'perma-comment',
			attr: {rows: '4', cols: '50'}
		});

		commentTextarea.value = this.answers.get(question.id)?.reflection ?? '';

		// Enable file suggest functionality
		this.plugin.registerEditorSuggest(this.fileSuggest);

		// Update the answer when the textarea changes
		commentTextarea.addEventListener('input', (event) => {
			const currentAnswer = this.answers.get(question.id) ?? { score: (question.scale.max - question.scale.min) / 2, reflection: '' };
			this.answers.set(question.id, { ...currentAnswer, reflection: (event.target as HTMLTextAreaElement).value });
		});

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
		const categories = {
			P: ['P1', 'P2', 'P3'],
			E: ['E1', 'E2', 'E3'],
			R: ['R1', 'R2', 'R3'],
			M: ['M1', 'M2', 'M3'],
			A: ['A1', 'A2', 'A3'],
			N: ['N1', 'N2', 'N3'],
			H: ['H1', 'H2', 'H3'],
		};
		
		const scores: Record<string, number> = {};
		
		for (const [category, questionIds] of Object.entries(categories)) {
			const categoryScores = questionIds.map(id => this.answers.get(id)?.score || 0);
			scores[category] = categoryScores.reduce((sum, score) => sum + score, 0) / categoryScores.length;
		}
		
		// Calculate overall well-being (PERMA)
		const permaQuestions = [...categories.P, ...categories.E, ...categories.R, ...categories.M, ...categories.A, 'hap'];
		const permaScores = permaQuestions.map(id => this.answers.get(id)?.score || 0);
		scores['PERMA'] = permaScores.reduce((sum, score) => sum + score, 0) / permaScores.length;
		
		// Add Loneliness score
		scores['Lon'] = this.answers.get('Lon')?.score || 0;
		
		return scores;
	}

	private interpretScore(score: number): string {
		if (score < 3.33) return "Low";
		if (score < 6.67) return "Moderate";
		return "High";
	}

	private generateInterpretation(category: string, score: number): string {
		const level = this.interpretScore(score);
		const interpretations = {
			P: {
				Low: "You may benefit from activities that boost positive emotions.",
				Moderate: "You experience positive emotions, but there's room for improvement.",
				High: "You frequently experience positive emotions and joy in your life."
			},
			E: {
				Low: "Consider finding more engaging activities in your daily life.",
				Moderate: "You feel engaged at times, but could seek more flow experiences.",
				High: "You often feel deeply engaged and absorbed in your activities."
			},
			R: {
				Low: "You might want to focus on building stronger relationships.",
				Moderate: "You have some good relationships, but could work on deepening connections.",
				High: "You have strong, supportive relationships in your life."
			},
			M: {
				Low: "Reflect on what gives your life purpose and meaning.",
				Moderate: "You have some sense of meaning, but could explore this further.",
				High: "You have a strong sense of purpose and meaning in your life."
			},
			A: {
				Low: "Set achievable goals to increase your sense of accomplishment.",
				Moderate: "You're making progress, but could set more challenging goals.",
				High: "You frequently feel a sense of accomplishment and achievement."
			}
		};
		return interpretations[category as keyof typeof interpretations][level as keyof typeof interpretations['P']];
	}

	private generateResultContent(scores: Record<string, number>) {
		const plugin = this.plugin;
		let content = plugin.settings.resultTemplate;
		
		const date = new Date().toISOString().split('T')[0];
		content = content.replace('{{date}}', date);
		
		// Generate scores and interpretations table
		let scoresTable = '| Category | Score | Interpretation |\n|----------|-------|----------------|\n';
		for (const [key, value] of Object.entries(scores)) {
			const interpretation = this.generateInterpretation(key, value);
			scoresTable += `| ${this.getCategoryFullName(key)} | ${value.toFixed(2)} | ${interpretation} |\n`;
			content = content.replace(`{{score_${key}}}`, value.toFixed(2));
		}
		
		content = content.replace('{{interpretations}}', scoresTable);
		
		// Add questions and reflections
		let questionsAndReflections = '## Questions and Reflections\n\n';
		this.questions.forEach((question, index) => {
			const answer = this.answers.get(question.id);
			questionsAndReflections += `### Question ${index + 1}: ${question.text}\n`;
			questionsAndReflections += `Score: ${answer?.score || 'Not answered'}\n`;
			if (answer?.reflection) {
				questionsAndReflections += `Reflection: ${answer.reflection}\n`;
			}
			questionsAndReflections += '\n';
		});
		
		content += '\n\n' + questionsAndReflections;
		
		return content;
	}

	private getCategoryFullName(key: string): string {
		const categories = {
			P: "Positive Emotion",
			E: "Engagement",
			R: "Relationships",
			M: "Meaning",
			A: "Accomplishment",
			N: "Negative Emotion",
			H: "Health",
			Lon: "Loneliness",
			PERMA: "Overall Well-being"
		};
		return categories[key as keyof typeof categories] || key;
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
