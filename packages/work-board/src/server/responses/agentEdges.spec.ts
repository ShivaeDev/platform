import { Effect } from "effect";
import { expect } from "vitest";
import { agentRequest } from "#server/responses/agent.ts";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { questionnaireAnswers } from "#test/questionnaire.ts";

boardStory.it("rejects unsafe agent server URLs through the typed error channel before creating any HTTP request", [], function* () {
	for (const url of [
		"not a URL",
		"https://127.0.0.1:4747",
		"http://remote.example",
		"http://user:pass@localhost:4747",
		"http://localhost:4747/path",
		"http://localhost:4747/?q=1",
		"http://localhost:4747/#fragment",
	]) {
		expect(yield* Effect.flip(agentRequest("question", { request: "item/request", url }))).toMatchObject({
			_tag: "BadRequest",
			message: "Use a loopback Work Board URL, such as http://127.0.0.1:4747.",
		});
	}
});

boardStory.it("reports malformed agent request references with the exact command correction", [aQuestionnaire()], function* ({ workspace }) {
	const url = workspace.board.url;
	expect(yield* Effect.flip(agentRequest("question", { request: "investigation.choices", url }))).toMatchObject({
		_tag: "BadRequest",
		message: "Use question <item>/<request>.",
	});
	expect(yield* Effect.flip(agentRequest("wait", { request: "investigation.choices/direction", url }))).toMatchObject({
		_tag: "BadRequest",
		message: "Use wait <item>/<request> --revision <reviewed SHA-256>, or wait <registered-question-id>.",
	});
});

boardStory.it(
	"previews, registers and reattaches agent shorthand to the same durable question through real HTTP",
	[aQuestionnaire()],
	function* ({ workspace }) {
		const url = workspace.board.url;
		const preview = yield* agentRequest("question", { request: "investigation.choices/direction", url });
		if (!("reviewedRevision" in preview)) {
			throw new Error("Expected a question preview");
		}
		const question = yield* Effect.promise(() => workspace.register());
		const saved = yield* Effect.promise(() =>
			workspace.client.mutate(
				workspace.client.responses.recordResponse.run({
					answers: questionnaireAnswers,
					author: "reviewer",
					body: "Keep the rationale.",
					id: "response.edge",
					question: question.id,
					type: "answer",
				}),
			),
		);
		const diagnostics: string[] = [];
		const result = yield* agentRequest("wait", { request: "investigation.choices/direction", revision: preview.reviewedRevision, url }, (text) =>
			diagnostics.push(text),
		);
		expect(result).toMatchObject({ kind: "response", question, response: saved });
		expect(diagnostics).toEqual([
			`Registered ${question.id}; reattach with work-board wait ${question.id}. Deadline: ${new Date(question.question.deadline).toISOString()}`,
		]);
		expect(yield* agentRequest("response", { request: question.id, url })).toEqual({ question, responses: [saved] });
	},
);
