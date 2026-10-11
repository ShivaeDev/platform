import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { agentRequest } from "#responses/agent.ts";
import { questionnaireAnswers } from "#test/questionnaire.ts";
import { responseWorkspace } from "#test/responseEdges.ts";

let workspace: Effect.Success<ReturnType<typeof responseWorkspace>>;

it("rejects unsafe agent server URLs before creating any HTTP request", () => {
	for (const url of [
		"https://127.0.0.1:4747",
		"http://remote.example",
		"http://user:pass@localhost:4747",
		"http://localhost:4747/path",
		"http://localhost:4747/?q=1",
		"http://localhost:4747/#fragment",
	]) {
		expect(() => agentRequest("question", { request: "item/request", url })).toThrow("Use a loopback Work Board URL, such as http://127.0.0.1:4747.");
	}
});

it.live("reports malformed agent request references with the exact command correction", function* () {
	workspace = yield* responseWorkspace();
	const url = workspace.board.url;
	expect((yield* Effect.flip(agentRequest("question", { request: "investigation.choices", url }))).message).toContain(
		"Use question <item>/<request>.",
	);
	expect((yield* Effect.flip(agentRequest("wait", { request: "investigation.choices/direction", url }))).message).toContain(
		"Use wait <item>/<request> --revision <reviewed SHA-256>, or wait <registered-question-id>.",
	);
});

it.live("previews, registers and reattaches agent shorthand to the same durable question through real HTTP", function* () {
	workspace = yield* responseWorkspace();
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
});
