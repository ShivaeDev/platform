import { readdirSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Cause, Clock, Effect, Fiber } from "effect";
import { expect } from "vitest";
import { folder } from "#test/board.ts";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { outsideResponseDirectory } from "#test/responseFiles.ts";
import { responseDraft } from "#test/storyResponses.ts";
import { agentRequest } from "./agent.ts";
import { questionFrom, questionMarkdown } from "./records.ts";

const source = `---
id: investigation.model
kind: investigation
attention:
  - id: review-model
    kind: review
    state: open
    response_from: [maintainer]
    reason: Which approach should we use?
    unblocks: [investigation.model]
---
# Model

Choose explicit requests.
`;

boardStory.it(
	"requires explicit write opt-in and rejects source forms at the HTTP boundary",
	[projectFiles({ "investigation.md": source }, "a project source awaits direction")],
	function* ({ notes, board, register, restart }) {
		expect(
			yield* register("investigation.model", "review-model").pipe(Effect.matchCause({ onFailure: Cause.squash, onSuccess: () => undefined })),
		).toMatchObject({
			message: expect.stringContaining("explicitly enable"),
		});
		expect(readdirSync(notes.root).sort()).toEqual(["board.sock", "investigation.md"]);
		({ board } = yield* restart(true));
		const forged = yield* Effect.promise(() =>
			fetch(`${board.url}/_board/rpc`, { body: "{}", headers: { "content-type": "text/plain", origin: board.url }, method: "POST" }),
		);
		expect(forged.status).toBe(403);
		const page = yield* Effect.promise(() => fetch(`${board.url}/_board/respond?item=investigation.model&request=review-model`));
		expect(page.headers.get("content-security-policy")).toContain("form-action 'none'");
		const html = yield* Effect.promise(() => page.text());
		expect(html).toContain("data-board-react-root");
	},
);

boardStory.it(
	"publishes one durable question and response, leaves original bytes unchanged, and reconciles repeated writes",
	[projectFiles({ "investigation.md": source }, "a project source awaits direction"), responsesEnabled()],
	function* ({ notes, board, client, register, restart }) {
		const question = yield* register("investigation.model", "review-model");
		expect((yield* register("investigation.model", "review-model")).question.registeredAt).toBe(question.question.registeredAt);
		const saved = yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(responseDraft(question.id))));
		expect(yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(responseDraft(question.id))))).toEqual(saved);
		expect(readFileSync(join(notes.root, "investigation.md"), "utf8")).toBe(source);
		expect(readdirSync(join(notes.root, "responses")).sort()).toEqual([`${question.id}.md`, "response.first.md"].sort());
		yield* Effect.promise(() =>
			expect(client.mutate(client.responses.recordResponse.run(responseDraft(question.id, "response.first", "Different intent")))).rejects.toThrow(
				"different content",
			),
		);
		({ board, client } = yield* restart(true));
		expect((yield* Effect.promise(() => client.run(client.responses.responses.run({ question: question.id })))).responses).toEqual([saved]);
		const result = yield* agentRequest("wait", { request: question.id, url: board.url });
		expect(result).toMatchObject({ kind: "response", question, response: saved });
	},
);

boardStory.it(
	"retains attributable old replies but rejects a stale new save or changed request generation",
	[projectFiles({ "investigation.md": source }, "a project source awaits direction"), responsesEnabled()],
	function* ({ client, register, editFile }) {
		const question = yield* register("investigation.model", "review-model");
		const saved = yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(responseDraft(question.id))));
		editFile("investigation.md", source.replace("Choose explicit requests.", "Changed proposal."));
		yield* Effect.promise(() =>
			expect(client.mutate(client.responses.recordResponse.run(responseDraft(question.id, "response.second")))).rejects.toThrow("Source changed"),
		);
		yield* Effect.promise(() =>
			expect(
				client.mutate(
					client.responses.registerQuestion.run({
						item: "investigation.model",
						request: "review-model",
						revision: question.question.reviewedRevision,
					}),
				),
			).rejects.toThrow("Source changed"),
		);
		expect((yield* Effect.promise(() => client.run(client.responses.responses.run({ question: question.id })))).responses).toEqual([saved]);
		const next = yield* register("investigation.model", "review-model");
		expect(next.id).not.toBe(question.id);
	},
);

boardStory.it(
	"rejects rename/delete and escaping response links without writing outside the root",
	[projectFiles({ "investigation.md": source }, "a project source awaits direction"), responsesEnabled()],
	function* ({ notes, client, register, editFile }) {
		const question = yield* register("investigation.model", "review-model");
		renameSync(join(notes.root, "investigation.md"), join(notes.root, "moved.md"));
		yield* Effect.promise(() =>
			expect(client.mutate(client.responses.recordResponse.run(responseDraft(question.id)))).rejects.toThrow("Source changed"),
		);
		unlinkSync(join(notes.root, "moved.md"));
		yield* Effect.promise(() => expect(client.mutate(client.responses.recordResponse.run(responseDraft(question.id)))).rejects.toThrow());
		const outside = folder({});
		try {
			editFile("investigation.md", source.replace("Choose explicit requests.", "A new reviewed generation."));
			renameSync(join(notes.root, "responses"), join(notes.root, "old-responses"));
			outsideResponseDirectory(notes.root, outside.root);
			expect((yield* Effect.exit(register("investigation.model", "review-model")))._tag).toBe("Failure");
			expect(readdirSync(outside.root)).toEqual([]);
		} finally {
			outside.remove();
		}
	},
);

boardStory.it(
	"returns clarification separately and waits for the next attributable reply without consuming either",
	[projectFiles({ "investigation.md": source }, "a project source awaits direction"), responsesEnabled()],
	function* ({ board, client, register }) {
		const question = yield* register("investigation.model", "review-model");
		const first = yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run({ ...responseDraft(question.id), type: "clarify" })));
		const waiting = yield* agentRequest("wait", { after: first.id, request: question.id, url: board.url }).pipe(Effect.forkChild);
		const second = yield* Effect.promise(() =>
			client.mutate(client.responses.recordResponse.run(responseDraft(question.id, "response.second", "No."))),
		);
		expect(yield* Fiber.join(waiting)).toMatchObject({ response: second });
		expect(second.response.recordedAt).toBeGreaterThan(first.response.recordedAt);
		expect(yield* agentRequest("wait", { request: question.id, url: board.url })).toMatchObject({ response: first });
		expect(questionFrom({ file: "plain.md", parsed: { body: "plain", bodyLine: 1, diagnostics: [], fields: {}, lines: {} } })).toBeUndefined();
	},
);

boardStory.it(
	"shows ambiguous recorded history as unavailable instead of falsely saying no response exists",
	[projectFiles({ "investigation.md": source }, "a project source awaits direction"), responsesEnabled()],
	function* ({ notes, client, register, editFile }) {
		const question = yield* register("investigation.model", "review-model");
		editFile("duplicate.md", readFileSync(join(notes.root, "responses", `${question.id}.md`), "utf8"));
		yield* Effect.promise(() =>
			expect(client.run(client.responses.responses.run({ question: question.id }))).rejects.toThrow("response history is unknown"),
		);
	},
);

boardStory.it(
	"does not interpret malformed recorded feedback as an unanswered human request",
	[projectFiles({ "investigation.md": source }, "a project source awaits direction"), responsesEnabled()],
	function* ({ client, register, editFile }) {
		const question = yield* register("investigation.model", "review-model");
		editFile(
			"responses/response.broken.md",
			"---\nid: response.broken\nkind: response\nresponse: { type: answer }\n---\nActual feedback with incomplete provenance\n",
		);
		yield* Effect.promise(() =>
			expect(client.run(client.responses.responses.run({ question: question.id }))).rejects.toThrow("history cannot be established"),
		);
	},
);

boardStory.it(
	"treats syntactically damaged record files as unknown history while ordinary malformed Markdown still reads",
	[projectFiles({ "investigation.md": source }, "a project source awaits direction"), responsesEnabled()],
	function* ({ client, register, editFile }) {
		const question = yield* register("investigation.model", "review-model");
		const expired = {
			...question,
			question: {
				...question.question,
				deadline: (yield* Clock.currentTimeMillis) - 1,
				registeredAt: (yield* Clock.currentTimeMillis) - 48 * 60 * 60 * 1000 - 1,
			},
		};
		editFile(`responses/${question.id}.md`, questionMarkdown(expired));
		const broken = "---\nid: response.broken\nkind: response\nresponse: [broken\n---\nActual human feedback\n";
		editFile("unrelated.md", broken);
		expect((yield* Effect.promise(() => client.run(client.responses.responses.run({ question: question.id })))).responses).toEqual([]);
		editFile("responses/response.broken.md", broken);
		yield* Effect.promise(() =>
			expect.poll(() => client.run(client.responses.responses.run({ question: question.id })).then(() => "Readable", String)).toContain("malformed"),
		);
		yield* Effect.promise(() => expect(client.run(client.responses.awaitResponse.run({ question: question.id }))).rejects.toThrow("malformed"));
		editFile("responses/response.broken.md", "---\nid: response.broken\nkind: response\nActual human feedback\n");
		yield* Effect.promise(() => expect(client.run(client.responses.awaitResponse.run({ question: question.id }))).rejects.toThrow("malformed"));
		yield* Effect.promise(() => expect(client.run(client.responses.responses.run({ question: question.id }))).rejects.toThrow("malformed"));
	},
);
