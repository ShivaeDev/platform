import { Effect } from "effect";
import { expect } from "vitest";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { responseInput } from "#test/coverageEdges.ts";
import { questionnaireAnswers, questionnaireSource } from "#test/questionnaire.ts";

boardStory.it(
	"requires an option before recording an answer while allowing explanatory clarification",
	[aQuestionnaire(questionnaireSource.replace('select="one"', 'select="one" required="selection"'))],
	function* ({ workspace: { client, register } }) {
		const page = yield* Effect.promise(() => client.read(client.api.board.query({ url: "/proposal.md" })));
		expect(page.document.requests[0]?.prompts?.[0]?.requireSelection).toBe(true);
		const question = yield* Effect.promise(register);
		const input = { ...responseInput, answers: [{ ...questionnaireAnswers[0], selected: [] }, questionnaireAnswers[1]], question: question.id };
		const failure = yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(input)).catch((error: unknown) => error));
		expect(failure).toBeInstanceOf(Conflict);
		expect(failure).toMatchObject({ message: expect.stringContaining("Choose an option") });
		const saved = yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run({ ...input, type: "clarify" })));
		expect(saved.response.type).toBe("clarify");
		expect(saved.body).toContain(questionnaireAnswers[0].text);
	},
);
