import { readdirSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Cause, Clock, Effect, Fiber } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#client/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { outsideResponseDirectory } from "#test/responseFiles.ts";
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

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;

afterEach(() => {
	client?.registry.dispose();
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* (enabled = true) {
	notes = folder({ "investigation.md": source });
	board = yield* startBoard(notes.root, undefined, (fs) => fs, enabled);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
});

const register = Effect.fn("Test.register")(function* () {
	const question = yield* Effect.promise(() => client.run(client.responses.question.run({ item: "investigation.model", request: "review-model" })));
	return yield* Effect.promise(() =>
		client.mutate(
			client.responses.registerQuestion.run({ item: "investigation.model", request: "review-model", revision: question.reviewedRevision }),
		),
	);
});

function input(question: string, id = "response.first", body = "Use explicit requests.") {
	return {
		author: "maintainer",
		body,
		id,
		question,
		type: "answer" as const,
	};
}

it.live("requires explicit write opt-in and rejects source forms at the HTTP boundary", function* () {
	yield* open(false);
	expect(yield* register().pipe(Effect.matchCause({ onFailure: Cause.squash, onSuccess: () => undefined }))).toMatchObject({
		message: expect.stringContaining("explicitly enable"),
	});
	expect(readdirSync(notes.root)).toEqual(["investigation.md"]);
	yield* board.stop();
	client.registry.dispose();
	board = yield* startBoard(notes.root, undefined, (fs) => fs, true);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
	const forged = yield* Effect.promise(() =>
		fetch(`${board.url}/_board/rpc`, { body: "{}", headers: { "content-type": "text/plain", origin: board.url }, method: "POST" }),
	);
	expect(forged.status).toBe(403);
	const page = yield* Effect.promise(() => fetch(`${board.url}/_board/respond?item=investigation.model&request=review-model`));
	expect(page.headers.get("content-security-policy")).toContain("form-action 'none'");
	const html = yield* Effect.promise(() => page.text());
	expect(html).toContain('id="answer-card-review-model"');
	expect(html).toContain("Original frontmatter");
});

it.live("publishes one durable question and response, leaves original bytes unchanged, and reconciles repeated writes", function* () {
	yield* open();
	const question = yield* register();
	expect((yield* register()).question.registeredAt).toBe(question.question.registeredAt);
	const saved = yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(input(question.id))));
	expect(yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(input(question.id))))).toEqual(saved);
	expect(readFileSync(join(notes.root, "investigation.md"), "utf8")).toBe(source);
	expect(readdirSync(join(notes.root, "responses")).sort()).toEqual([`${question.id}.md`, "response.first.md"].sort());
	yield* Effect.promise(() =>
		expect(client.mutate(client.responses.recordResponse.run(input(question.id, "response.first", "Different intent")))).rejects.toThrow(
			"different content",
		),
	);
	yield* board.stop();
	client.registry.dispose();
	board = yield* startBoard(notes.root, undefined, (fs) => fs, true);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
	expect((yield* Effect.promise(() => client.run(client.responses.responses.run({ question: question.id })))).responses).toEqual([saved]);
	const result = yield* agentRequest("wait", { request: question.id, url: board.url });
	expect(result).toMatchObject({ kind: "response", question, response: saved });
});

it.live("retains attributable old replies but rejects a stale new save or changed request generation", function* () {
	yield* open();
	const question = yield* register();
	const saved = yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(input(question.id))));
	notes.write("investigation.md", source.replace("Choose explicit requests.", "Changed proposal."));
	yield* Effect.promise(() =>
		expect(client.mutate(client.responses.recordResponse.run(input(question.id, "response.second")))).rejects.toThrow("Source changed"),
	);
	yield* Effect.promise(() =>
		expect(
			client.mutate(
				client.responses.registerQuestion.run({ item: "investigation.model", request: "review-model", revision: question.question.reviewedRevision }),
			),
		).rejects.toThrow("Source changed"),
	);
	expect((yield* Effect.promise(() => client.run(client.responses.responses.run({ question: question.id })))).responses).toEqual([saved]);
	const next = yield* register();
	expect(next.id).not.toBe(question.id);
});

it.live("rejects rename/delete and escaping response links without writing outside the root", function* () {
	yield* open();
	const question = yield* register();
	renameSync(join(notes.root, "investigation.md"), join(notes.root, "moved.md"));
	yield* Effect.promise(() => expect(client.mutate(client.responses.recordResponse.run(input(question.id)))).rejects.toThrow("Source changed"));
	unlinkSync(join(notes.root, "moved.md"));
	yield* Effect.promise(() => expect(client.mutate(client.responses.recordResponse.run(input(question.id)))).rejects.toThrow());
	const outside = folder({});
	try {
		notes.write("investigation.md", source.replace("Choose explicit requests.", "A new reviewed generation."));
		renameSync(join(notes.root, "responses"), join(notes.root, "old-responses"));
		outsideResponseDirectory(notes.root, outside.root);
		expect((yield* Effect.exit(register()))._tag).toBe("Failure");
		expect(readdirSync(outside.root)).toEqual([]);
	} finally {
		outside.remove();
	}
});

it.live("returns clarification separately and waits for the next attributable reply without consuming either", function* () {
	yield* open();
	const question = yield* register();
	const first = yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run({ ...input(question.id), type: "clarify" })));
	const waiting = yield* agentRequest("wait", { after: first.id, request: question.id, url: board.url }).pipe(Effect.forkChild);
	const second = yield* Effect.promise(() => client.mutate(client.responses.recordResponse.run(input(question.id, "response.second", "No."))));
	expect(yield* Fiber.join(waiting)).toMatchObject({ response: second });
	expect(second.response.recordedAt).toBeGreaterThan(first.response.recordedAt);
	expect(yield* agentRequest("wait", { request: question.id, url: board.url })).toMatchObject({ response: first });
	expect(questionFrom({ file: "plain.md", parsed: { body: "plain", bodyLine: 1, diagnostics: [], fields: {}, lines: {} } })).toBeUndefined();
});

it.live("shows ambiguous recorded history as unavailable instead of falsely saying no response exists", function* () {
	yield* open();
	const question = yield* register();
	notes.write("duplicate.md", readFileSync(join(notes.root, "responses", `${question.id}.md`), "utf8"));
	yield* Effect.promise(() =>
		expect(client.run(client.api.respond.run({ url: "/_board/respond?item=investigation.model&request=review-model" }))).rejects.toThrow(
			"response history is unknown",
		),
	);
});

it.live("does not interpret malformed recorded feedback as an unanswered human request", function* () {
	yield* open();
	const question = yield* register();
	notes.write(
		"responses/response.broken.md",
		"---\nid: response.broken\nkind: response\nresponse: { type: answer }\n---\nActual feedback with incomplete provenance\n",
	);
	yield* Effect.promise(() =>
		expect(client.run(client.responses.responses.run({ question: question.id }))).rejects.toThrow("history cannot be established"),
	);
});

it.live("treats syntactically damaged record files as unknown history while ordinary malformed Markdown still reads", function* () {
	yield* open();
	const question = yield* register();
	const expired = {
		...question,
		question: {
			...question.question,
			deadline: (yield* Clock.currentTimeMillis) - 1,
			registeredAt: (yield* Clock.currentTimeMillis) - 48 * 60 * 60 * 1000 - 1,
		},
	};
	notes.write(`responses/${question.id}.md`, questionMarkdown(expired));
	const broken = "---\nid: response.broken\nkind: response\nresponse: [broken\n---\nActual human feedback\n";
	notes.write("unrelated.md", broken);
	expect((yield* Effect.promise(() => client.run(client.responses.responses.run({ question: question.id })))).responses).toEqual([]);
	notes.write("responses/response.broken.md", broken);
	yield* Effect.promise(() =>
		expect.poll(() => client.run(client.responses.responses.run({ question: question.id })).then(() => "Readable", String)).toContain("malformed"),
	);
	yield* Effect.promise(() => expect(client.run(client.responses.awaitResponse.run({ question: question.id }))).rejects.toThrow("malformed"));
	notes.write("responses/response.broken.md", "---\nid: response.broken\nkind: response\nActual human feedback\n");
	yield* Effect.promise(() => expect(client.run(client.responses.awaitResponse.run({ question: question.id }))).rejects.toThrow("malformed"));
	yield* Effect.promise(() =>
		expect(client.run(client.api.respond.run({ url: "/_board/respond?item=investigation.model&request=review-model" }))).rejects.toThrow("malformed"),
	);
});
