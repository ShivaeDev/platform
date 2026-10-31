import { expect } from "vitest";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { questionnaireSource, scopedQuestionnaire } from "#test/questionnaire.ts";

const prefix = questionnaireSource.slice(0, questionnaireSource.indexOf("::::question"));
const SHAPE =
	"bad request: Invalid response template: A question needs Markdown context and 1–32 direct options (or select=text without options), without nested questions.";
const OPTION_SHAPE = "bad request: Invalid response template: Options need Markdown descriptions and cannot nest response controls.";
const QUESTION_IDS = "bad request: Invalid response template: Use at most 32 questions with unique IDs per attention request.";
const PROMPT = '::::question{id="next"}\nChoose.\n\n:::option{id="first"}\nFirst.\n:::\n::::\n';

for (const { refusal, source, template } of [
	{
		refusal: "bad request: Invalid response template: A question's request= must name an attention request in this document.",
		source: questionnaireSource.replace('id="display"', 'id="display" request="missing"'),
		template: "scopes a prompt to a request the item lacks",
	},
	{
		refusal: "bad request: Invalid response template: Use request= on question directives when a document has several open attention requests.",
		source: scopedQuestionnaire.replaceAll(' request="direction"', "").replaceAll(' request="verification"', ""),
		template: "leaves prompts unscoped although the item has two requests",
	},
	{
		refusal: "bad request: Invalid response template: Use top-level question containers with direct option children.",
		source: `${prefix}> ::option[Orphan]{id="orphan"}\n`,
		template: "has an option outside any question",
	},
	{
		refusal: QUESTION_IDS,
		source: questionnaireSource.replace('id="checks"', 'id="display"'),
		template: "repeats a prompt ID",
	},
	{
		refusal: QUESTION_IDS,
		source: prefix + Array.from({ length: 33 }, (_, index) => PROMPT.replace('id="next"', `id="next${index}"`)).join("\n"),
		template: "has 33 prompts",
	},
	{ refusal: SHAPE, source: prefix + PROMPT.replace("Choose.\n\n", ""), template: "has a prompt without context" },
	{
		refusal: SHAPE,
		source: prefix + PROMPT.replace('id="next"', 'id="next" select="text"'),
		template: "gives a text-only prompt options",
	},
	{ refusal: SHAPE, source: `${prefix}::::question{id="next"}\nChoose.\n::::\n`, template: "has a choice prompt without options" },
	{
		refusal: OPTION_SHAPE,
		source: prefix + PROMPT.replace("First.", '::option[Nested]{id="nested"}'),
		template: "nests an option inside an option",
	},
	{ refusal: OPTION_SHAPE, source: prefix + PROMPT.replace("First.\n", ""), template: "has an option without a description" },
	{
		refusal: "bad request: Invalid response template: Option IDs must be unique within each question.",
		source: questionnaireSource.replace('id="history"', 'id="latest"'),
		template: "repeats an option ID",
	},
	{
		refusal: 'bad request: Invalid response template: Expected "one" | "many" | "text"\n  at ["select"]',
		source: questionnaireSource.replace('select="one"', 'select="invalid"'),
		template: "names an unknown selection mode",
	},
	{
		refusal: SHAPE,
		source: prefix + PROMPT.replace("Choose.", '::question[Nested]{id="nested"}'),
		template: "nests a question inside a question",
	},
	{
		refusal: SHAPE,
		source:
			prefix
			+ PROMPT.replace(
				':::option{id="first"}\nFirst.\n:::',
				Array.from({ length: 33 }, (_, index) => `:::option{id="option${index}"}\nOption.\n:::`).join("\n\n"),
			),
		template: "gives a prompt 33 options",
	},
]) {
	boardStory.it(
		`reading a question whose template ${template} is refused as a bad request`,
		[aQuestionnaire(source)],
		function* ({ questionPreview }) {
			expect(yield* questionPreview("investigation.choices", "direction")).toBe(refusal);
		},
	);
}

const AUTHORED = "---\nid: question.choices\nkind: question\nscope: task\nurgency: whenever\n";

for (const { options, refusal, source } of [
	{
		options: "repeats an option label",
		refusal: "bad request: Invalid response template: Question option labels must be unique. Rename the repeated labels in the source.",
		source: `${AUTHORED}options:\n  - label: First\n    description: First choice.\n  - label: First\n    description: Another choice.\n---\n# Choose\n`,
	},
	{
		options: "recommends an option it does not offer",
		refusal: "bad request: Invalid response template: The recommended option must name an option label.",
		source: `${AUTHORED}options:\n  - label: First\n    description: First choice.\nrecommended: Missing\n---\n# Choose\n`,
	},
	{
		options: "offers frontmatter options beside Markdown prompts",
		refusal: "bad request: Invalid response template: Use frontmatter options or Markdown question directives, rather than both.",
		source: `${AUTHORED}options:\n  - label: First\n    description: First choice.\n---\n# Choose\n${PROMPT}`,
	},
]) {
	boardStory.it(
		`reading an authored question that ${options} is refused as a bad request`,
		[aQuestionnaire(source)],
		function* ({ questionPreview }) {
			expect(yield* questionPreview("question.choices", "answer")).toBe(refusal);
		},
	);
}
