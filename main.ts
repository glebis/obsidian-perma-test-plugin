import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, EditorSuggest, EditorPosition, EditorSuggestTriggerInfo, EditorSuggestContext, MarkdownRenderer } from 'obsidian';
import { questions, Question } from './questions_en';

interface PermaPluginSettings {
	resultTemplate: string;
	fileNamingConvention: string;
	defaultSaveLocation: string;
	showRibbonIcon: boolean;
	createResultFile: boolean;
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
	resultTemplate: '# PERMA Profiler Results\n\nDate: {{date}}\n\n## Scores and Interpretations\n\n{{interpretations}}\n\n## Overall Reflection\n\n[Your overall reflection on the PERMA test results goes here]\n\n#perma-profiler-test',
	fileNamingConvention: 'PERMA-Results-{{date}}',
	defaultSaveLocation: '/',
	showRibbonIcon: true,
	createResultFile: true
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
				new PermaAboutModal(this.app, this).open();
			});
			ribbonIconEl.addClass('perma-profiler-ribbon-class');
		}

		// Add command to start the PERMA Profiler test
		this.addCommand({
			id: 'start-perma-test',
			name: 'Start PERMA Profiler',
			callback: () => {
				new PermaAboutModal(this.app, this).open();
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

	resetTemplateToDefault() {
		this.settings.resultTemplate = DEFAULT_SETTINGS.resultTemplate as string;
		this.saveSettings();
	}

	generateInterpretation(category: string, score: number): string {
		const level = this.interpretScore(score);
		const interpretations: Record<string, Record<string, string>> = {
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
			},
			N: {
				Low: "You experience low levels of negative emotions, which is generally good.",
				Moderate: "You experience moderate levels of negative emotions.",
				High: "You might want to find ways to reduce negative emotions in your life."
			},
			H: {
				Low: "Consider focusing on improving your overall health.",
				Moderate: "Your health is average, but there's room for improvement.",
				High: "You're in good health compared to others your age and gender."
			},
			Lon: {
				Low: "You don't often feel lonely, which is positive.",
				Moderate: "You sometimes feel lonely, which is common.",
				High: "You might benefit from seeking more social connections."
			},
			PERMA: {
				Low: "Your overall well-being could use some improvement.",
				Moderate: "Your overall well-being is average, with room for growth.",
				High: "You have a high level of overall well-being."
			}
		};

		if (interpretations[category] && interpretations[category][level]) {
			return interpretations[category][level];
		} else {
			return `Your score for ${this.getCategoryFullName(category)} is in the ${level} range.`;
		}
	}

	private interpretScore(score: number): string {
		if (score < 3.33) return "Low";
		if (score < 6.67) return "Moderate";
		return "High";
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
}

class PermaPostTestModal extends Modal {
	plugin: PermaPlugin;
	scores: Record<string, number>;

	constructor(app: App, plugin: PermaPlugin, scores: Record<string, number>) {
		super(app);
		this.plugin = plugin;
		this.scores = scores;
	}

	async onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl('h2', {text: 'PERMA Profiler Test Completed'});
		
		// Add results table
		const resultsTable = contentEl.createEl('table', {cls: 'perma-results-table'});
		const headerRow = resultsTable.createEl('tr');
		headerRow.createEl('th', {text: 'Category'});
		headerRow.createEl('th', {text: 'Score'});
		headerRow.createEl('th', {text: 'Interpretation'});

		for (const [key, value] of Object.entries(this.scores)) {
			const row = resultsTable.createEl('tr');
			row.createEl('td', {text: this.getCategoryFullName(key)});
			row.createEl('td', {text: value.toFixed(2)});
			row.createEl('td', {text: this.interpretScore(value)});
		}

		const aboutContent = contentEl.createEl('div', {cls: 'perma-about-content'});
		const aboutText = await this.app.vault.adapter.read(`${this.plugin.manifest.dir}/about_en.md`);
		await MarkdownRenderer.renderMarkdown(aboutText, aboutContent, '', this.plugin);

		const buttonContainer = contentEl.createEl('div', {cls: 'perma-button-container'});
		const closeButton = buttonContainer.createEl('button', {text: 'Close'});
		closeButton.onclick = () => this.close();

		const retakeButton = buttonContainer.createEl('button', {text: 'Retake Test'});
		retakeButton.onclick = () => {
			this.close();
			new PermaTestModal(this.app, this.plugin).open();
		};
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
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

	private interpretScore(score: number): string {
		if (score < 3.33) return "Low";
		if (score < 6.67) return "Moderate";
		return "High";
	}
}

class PermaAboutModal extends Modal {
	plugin: PermaPlugin;

	constructor(app: App, plugin: PermaPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl('h2', {text: 'About PERMA Profiler'});
		
		const aboutContent = contentEl.createEl('div', {cls: 'perma-about-content'});
		aboutContent.innerHTML = `
			<p>The PERMA Profiler is a brief multidimensional measure of flourishing. It assesses Well-Being Theory's five domains: Positive Emotion, Engagement, Relationships, Meaning, and Accomplishment.</p>
			<h3>Instructions</h3>
			<p>The following questions ask you about aspects of your well-being. Please read each question carefully and respond using the scale provided.</p>
			<ul>
				<li>There are no right or wrong answers.</li>
				<li>Please be as honest and accurate as possible.</li>
				<li>You will have a chance to reflect on each question after answering.</li>
			</ul>
			<p>The test consists of 23 questions and typically takes about 5-10 minutes to complete.</p>
		`;

		const startButton = contentEl.createEl('button', {text: 'Start Test', cls: 'perma-start-test-button'});
		startButton.onclick = () => {
			this.close();
			new PermaTestModal(this.app, this.plugin).open();
		};
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class PermaTestModal extends Modal {
	private currentQuestion: number = 0;
	private answers: Map<string, { score: number; reflection: string }> = new Map();
	private questions: Question[];
	private plugin: PermaPlugin;
	private fileSuggest: FileSuggest;
	private isReflectionActive: boolean = false;

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
		this.plugin.registerDomEvent(document, 'keydown', this.handleKeyDown.bind(this));
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}

	private handleKeyDown(event: KeyboardEvent) {
		if (this.isReflectionActive) return;

		const key = event.key;
		if (key >= '0' && key <= '9') {
			const score = parseInt(key);
			this.selectAnswer(score);
		} else if (key === 'Enter') {
			this.nextQuestion();
		}
	}

	private selectAnswer(score: number) {
		const question = this.questions[this.currentQuestion];
		const currentAnswer = this.answers.get(question.id) || { score: 0, reflection: '' };
		this.answers.set(question.id, { ...currentAnswer, score: score });
		this.displayQuestion();
	}

	private displayQuestion() {
		const {contentEl} = this;
		contentEl.empty();

		const question = this.questions[this.currentQuestion];
		const questionEl = contentEl.createEl('div', {cls: 'perma-question'});
		questionEl.createEl('div', {text: `${this.currentQuestion + 1} / ${this.questions.length}`, cls: 'perma-question-number'});
		questionEl.createEl('h1', {text: question.text});

		const answerContainer = contentEl.createEl('div', {cls: 'perma-answer-container'});
		answerContainer.createEl('div', {text: `${question.scale.minLabel} = 0, ${question.scale.maxLabel} = 10`, cls: 'perma-answer-description'});
		
		const buttonContainer = answerContainer.createEl('div', {cls: 'perma-button-container'});
		for (let i = 0; i <= 10; i++) {
			const button = buttonContainer.createEl('button', {text: i.toString(), cls: 'perma-answer-button'});
			const currentScore = this.answers.get(question.id)?.score ?? 0;
			if (currentScore === i) {
				button.addClass('perma-answer-button-selected');
			}
			button.onclick = () => this.selectAnswer(i);
		}

		// If no answer is set for this question, select button 0 by default
		if (!this.answers.has(question.id)) {
			this.answers.set(question.id, { score: 0, reflection: '' });
			buttonContainer.querySelector('.perma-answer-button')?.addClass('perma-answer-button-selected');
		}

		// Add collapsible reflections section
		const reflectionsSetting = new Setting(contentEl)
			.setName('Reflections')
			.setDesc('Any thoughts this question')
			.addToggle(toggle => toggle
				.setValue(false)
				.onChange(value => {
					reflectionsContent.style.display = value ? 'block' : 'none';
					if (value) {
						setTimeout(() => commentTextarea.focus(), 0);
					}
					this.isReflectionActive = value;
				})
			);

		const reflectionsContent = contentEl.createEl('div', {cls: 'perma-reflections-content'});
		reflectionsContent.style.display = 'none';

		const commentTextarea = reflectionsContent.createEl('textarea', {
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
		
		if (this.plugin.settings.createResultFile) {
			// Create and open the new note
			const fileName = this.generateFileName();
			const file = await this.createResultNote(fileName, content);
			
			// Open the newly created note
			if (file instanceof TFile) {
				this.app.workspace.getLeaf().openFile(file);
			}
			
			new Notice('Test completed! Results have been generated and saved.');
		} else {
			new Notice('Test completed! Results have been generated.');
		}
		
		this.close();
		new PermaPostTestModal(this.app, this.plugin, scores).open();
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
		return this.plugin.generateInterpretation(category, score);
	}

	private generateResultContent(scores: Record<string, number>) {
		const plugin = this.plugin;
		let content = plugin.settings.resultTemplate;
		
		const now = new Date();
		const date = now.toISOString().split('T')[0];
		const time = now.toTimeString().split(' ')[0];
		content = content.replace('{{date}}', `${date} ${time}`);
		
		// Generate scores and interpretations table
		let scoresTable = '| Category | Score | Interpretation |\n|----------|-------|----------------|\n';
		for (const [key, value] of Object.entries(scores)) {
			const interpretation = this.generateInterpretation(key, value);
			scoresTable += `| ${this.getCategoryFullName(key)} | ${value.toFixed(2)} | ${interpretation} |\n`;
			content = content.replace(`{{score_${key}}}`, value.toFixed(2));
		}
		
		content = content.replace('{{interpretations}}', scoresTable);
		
		// Add reflection questions
		let reflectionQuestions = '## Reflection Questions\n\n';
		reflectionQuestions += '- What aspects of your well-being are you most satisfied with based on these results?\n';
		reflectionQuestions += '- Which areas do you feel you could improve upon, and what specific actions might help?\n';
		reflectionQuestions += '- How do these results align with your personal goals and values?\n\n';
		
		content = content.replace('[Your overall reflection on the PERMA test results goes here]', reflectionQuestions);
		
		// Add questions and reflections
		let questionsAndReflections = '## Questions and Reflections\n\n';
		this.questions.forEach((question, index) => {
			const answer = this.answers.get(question.id);
			questionsAndReflections += `### ${question.text}\n`;
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
		const now = new Date();
		const date = now.toISOString().split('T')[0];
		const time = now.toTimeString().split(' ')[0];
		return plugin.settings.fileNamingConvention.replace('{{date}}', `${date}-${time}`).replace(/:/g, '-') + '.md';
	}

	private async createResultNote(fileName: string, content: string) {
		const plugin = this.plugin;
		const path = `${plugin.settings.defaultSaveLocation}/${fileName}`;
		let file = this.app.vault.getAbstractFileByPath(path);
		if (file instanceof TFile) {
			// File exists, append the new content
			const existingContent = await this.app.vault.read(file);
			const updatedContent = existingContent + '\n\n' + content;
			await this.app.vault.modify(file, updatedContent);
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

		new Setting(containerEl)
			.setName('Create Result File')
			.setDesc('Toggle creation of result file')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.createResultFile)
				.onChange(async (value) => {
					this.plugin.settings.createResultFile = value;
					await this.plugin.saveSettings();
				}));
	}
}
