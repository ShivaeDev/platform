import { Effect } from "effect";
import { expect } from "vitest";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { questionnaireSource, scopedQuestionnaire } from "#test/questionnaire.ts";

const prefix = questionnaireSource.slice(0, questionnaireSource.indexOf("::::question"));
const PROMPT = '::::question{id="next"}\nChoose.\n\n:::option{id="first"}\nFirst.\n:::\n::::\n';
const cases = [
	{ message: "request= must name", source: questionnaireSource.replace('id="display"', 'id="display" request="missing"') },
	{ message: "Use request=", source: scopedQuestionnaire.replaceAll(' request="direction"', "").replaceAll(' request="verification"', "") },
	{ message: "top-level question containers", source: `${prefix}> ::option[Orphan]{id="orphan"}\n` },
	{ message: "unique IDs per attention request", source: questionnaireSource.replace('id="checks"', 'id="display"') },
	{
		message: "at most 32 questions",
		source: prefix + Array.from({ length: 33 }, (_, index) => PROMPT.replace('id="next"', `id="next${index}"`)).join("\n"),
	},
	{ message: "needs Markdown context", source: prefix + PROMPT.replace("Choose.\n\n", "") },
	{ message: "select=text without options", source: prefix + PROMPT.replace('id="next"', 'id="next" select="text"') },
	{ message: "1–32 direct options", source: `${prefix}::::question{id="next"}\nChoose.\n::::\n` },
	{ message: "cannot nest response controls", source: prefix + PROMPT.replace("First.", '::option[Nested]{id="nested"}') },
	{ message: "Options need Markdown descriptions", source: prefix + PROMPT.replace("First.\n", "") },
	{ message: "Option IDs must be unique", source: questionnaireSource.replace('id="history"', 'id="latest"') },
	{ message: "Invalid response template", source: questionnaireSource.replace('select="one"', 'select="invalid"') },
	{ message: "without nested questions", source: prefix + PROMPT.replace("Choose.", '::question[Nested]{id="nested"}') },
	{
		message: "1–32 direct options",
		source:
			prefix
			+ PROMPT.replace(
				':::option{id="first"}\nFirst.\n:::',
				Array.from({ length: 33 }, (_, index) => `:::option{id="option${index}"}\nOption.\n:::`).join("\n\n"),
			),
	},
];

for (const { source, message } of cases) {
	boardStory.it(`returns BadRequest to the HTTP caller for ${message}`, [aQuestionnaire(source)], function* ({ workspace: { client } }) {
		const failure = yield* Effect.promise(() =>
			client.run(client.responses.question.run({ item: "investigation.choices", request: "direction" })).catch((error: unknown) => error),
		);
		expect(failure).toBeInstanceOf(BadRequest);
		expect(failure).toMatchObject({ message: expect.stringContaining(message) });
	});
}

for (const { source, message } of [
	{
		message: "Question option labels must be unique",
		source:
			"---\nid: question.choices\nkind: question\nscope: task\nurgency: whenever\noptions:\n  - label: First\n    description: First choice.\n  - label: First\n    description: Another choice.\n---\n# Choose\n",
	},
	{
		message: "recommended option must name an option label",
		source:
			"---\nid: question.choices\nkind: question\nscope: task\nurgency: whenever\noptions:\n  - label: First\n    description: First choice.\nrecommended: Missing\n---\n# Choose\n",
	},
	{
		message: "Use frontmatter options or Markdown question directives",
		source: `---\nid: question.choices\nkind: question\nscope: task\nurgency: whenever\noptions:\n  - label: First\n    description: First choice.\n---\n# Choose\n${PROMPT}`,
	},
]) {
	boardStory.it("returns authored option failures as BadRequest through HTTP RPC", [aQuestionnaire(source)], function* ({ workspace: { client } }) {
		const failure = yield* Effect.promise(() =>
			client.run(client.responses.question.run({ item: "question.choices", request: "answer" })).catch((error: unknown) => error),
		);
		expect(failure).toBeInstanceOf(BadRequest);
		expect(failure).toMatchObject({ message: expect.stringContaining(message) });
	});
}
