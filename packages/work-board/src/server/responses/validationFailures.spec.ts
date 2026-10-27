import { Effect } from "effect";
import { expect } from "vitest";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import type { DraftInput } from "#browser/responses/schema.ts";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { responseInput, TEXT_QUESTION } from "#test/coverageEdges.ts";
import { questionnaireAnswers, questionnaireSource } from "#test/questionnaire.ts";

boardStory.it(
	"keeps each answer validation failure declared through real HTTP RPC",
	[aQuestionnaire()],
	function* ({ workspace: { client, register } }) {
		const question = yield* Effect.promise(register);
		const base = { ...responseInput, answers: questionnaireAnswers, question: question.id };
		const cases: readonly [DraftInput, string][] = [
			[{ ...base, answers: [...questionnaireAnswers].reverse() }, "Submit one answer per question"],
			[{ ...base, answers: [questionnaireAnswers[0]] }, "answer packet does not match"],
			[{ ...base, answers: [{ ...questionnaireAnswers[0], selected: ["absent"] }, questionnaireAnswers[1]] }, "not in the reviewed template"],
			[{ ...base, answers: [{ ...questionnaireAnswers[0], selected: ["latest", "history"] }, questionnaireAnswers[1]] }, "selection mode"],
			[{ ...base, answers: [questionnaireAnswers[0], { ...questionnaireAnswers[1], selected: ["back", "back"] }] }, "selection mode"],
			[{ ...base, answers: [{ ...questionnaireAnswers[0], selected: [], text: "" }, questionnaireAnswers[1]] }, "Answer every question"],
			[{ ...responseInput, question: question.id }, "requires answers for all prompts"],
			[{ ...base, answers: questionnaireAnswers.map((answer) => ({ ...answer, text: " " })), type: "clarify" }, "needs explanatory text"],
		];
		for (const [input, message] of cases) {
			const failure = yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(input)).catch((error: unknown) => error));
			expect(failure).toBeInstanceOf(Conflict);
			expect(failure).toMatchObject({ message: expect.stringContaining(message) });
		}
	},
);

boardStory.it(
	"returns a declared rejection for empty ordinary replies",
	[aQuestionnaire(questionnaireSource.slice(0, questionnaireSource.indexOf("::::question")))],
	function* ({ workspace: { client, register } }) {
		const question = yield* Effect.promise(register);
		const failure = yield* Effect.promise(() =>
			client.mutate(client.responses.recordResponse.run({ ...responseInput, question: question.id })).catch((error: unknown) => error),
		);
		expect(failure).toBeInstanceOf(Conflict);
		expect(failure).toMatchObject({ message: "A response needs text or answers to the question packet." });
	},
);

boardStory.it(
	"rejects the complete rendered answer size through the caller's error channel",
	[
		aQuestionnaire(
			questionnaireSource.slice(0, questionnaireSource.indexOf("::::question"))
				+ TEXT_QUESTION.replace("What should happen next?", "x".repeat(32_700)),
		),
	],
	function* ({ workspace: { client, register } }) {
		const question = yield* Effect.promise(register);
		const failure = yield* Effect.promise(() =>
			client
				.mutate(
					client.responses.recordResponse.run({
						...responseInput,
						answers: [{ prompt: "next", selected: [], text: "y".repeat(100) }],
						question: question.id,
					}),
				)
				.catch((error: unknown) => error),
		);
		expect(failure).toBeInstanceOf(Conflict);
		expect(failure).toMatchObject({
			message: "The complete recorded response exceeds 32768 characters. Shorten the response or split the source request.",
		});
	},
);
