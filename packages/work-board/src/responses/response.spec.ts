import { readdirSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { outsideResponseDirectory } from "#test/responseFiles.ts";
import { agentRequest } from "./agent.ts";
import { questionFrom } from "./records.ts";

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
afterEach(async () => {
	client?.registry.dispose();
	await board?.stop();
	notes?.remove();
});
async function open(enabled = true) {
	notes = folder({ "investigation.md": source });
	board = await startBoard(notes.root, undefined, (fs) => fs, enabled);
	client = browserClient(board.url);
}
async function register() {
	const question = await client.run(client.responses.question.run({ item: "investigation.model", request: "review-model" }));
	return client.mutate(
		client.responses.registerQuestion.run({ item: "investigation.model", request: "review-model", revision: question.reviewedRevision }),
	);
}
function input(question: string, id = "response.first", body = "Use explicit requests.") {
	return {
		author: "maintainer",
		body,
		id,
		question,
		type: "answer" as const,
	};
}
it("requires explicit write opt-in and rejects source forms at the HTTP boundary", async () => {
	await open(false);
	await expect(register()).rejects.toThrow("explicitly enable");
	expect(readdirSync(notes.root)).toEqual(["investigation.md"]);
	await board.stop();
	client.registry.dispose();
	board = await startBoard(notes.root, undefined, (fs) => fs, true);
	client = browserClient(board.url);
	const forged = await fetch(`${board.url}/_board/rpc`, { body: "{}", headers: { "content-type": "text/plain", origin: board.url }, method: "POST" });
	expect(forged.status).toBe(403);
	const page = await fetch(`${board.url}/_board/respond?item=investigation.model&request=review-model`);
	expect(page.headers.get("content-security-policy")).toContain("form-action 'none'");
	expect(await page.text()).toContain("Exact source being reviewed");
});
it("publishes one durable question and response, leaves original bytes unchanged, and reconciles repeated writes", async () => {
	await open();
	const question = await register();
	expect((await register()).question.registeredAt).toBe(question.question.registeredAt);
	const saved = await client.mutate(client.responses.recordResponse.run(input(question.id)));
	expect(await client.mutate(client.responses.recordResponse.run(input(question.id)))).toEqual(saved);
	expect(readFileSync(join(notes.root, "investigation.md"), "utf8")).toBe(source);
	expect(readdirSync(join(notes.root, "responses")).sort()).toEqual([`${question.id}.md`, "response.first.md"].sort());
	await expect(client.mutate(client.responses.recordResponse.run(input(question.id, "response.first", "Different intent")))).rejects.toThrow(
		"different content",
	);
	await board.stop();
	client.registry.dispose();
	board = await startBoard(notes.root, undefined, (fs) => fs, true);
	client = browserClient(board.url);
	expect((await client.run(client.responses.responses.run({ question: question.id }))).responses).toEqual([saved]);
	const result = await Effect.runPromise(agentRequest("wait", { request: question.id, url: board.url }));
	expect(result).toMatchObject({ kind: "response", question, response: saved });
});
it("retains attributable old replies but rejects a stale new save or changed request generation", async () => {
	await open();
	const question = await register();
	const saved = await client.mutate(client.responses.recordResponse.run(input(question.id)));
	notes.write("investigation.md", source.replace("Choose explicit requests.", "Changed proposal."));
	await expect(client.mutate(client.responses.recordResponse.run(input(question.id, "response.second")))).rejects.toThrow("Source changed");
	await expect(
		client.mutate(
			client.responses.registerQuestion.run({ item: "investigation.model", request: "review-model", revision: question.question.reviewedRevision }),
		),
	).rejects.toThrow("Source changed");
	expect((await client.run(client.responses.responses.run({ question: question.id }))).responses).toEqual([saved]);
	const next = await register();
	expect(next.id).not.toBe(question.id);
});
it("rejects rename/delete and escaping response links without writing outside the root", async () => {
	await open();
	const question = await register();
	renameSync(join(notes.root, "investigation.md"), join(notes.root, "moved.md"));
	await expect(client.mutate(client.responses.recordResponse.run(input(question.id)))).rejects.toThrow("Source changed");
	unlinkSync(join(notes.root, "moved.md"));
	await expect(client.mutate(client.responses.recordResponse.run(input(question.id)))).rejects.toThrow();
	const outside = folder({});
	try {
		notes.write("investigation.md", source.replace("Choose explicit requests.", "A new reviewed generation."));
		renameSync(join(notes.root, "responses"), join(notes.root, "old-responses"));
		outsideResponseDirectory(notes.root, outside.root);
		await expect(register()).rejects.toThrow();
		expect(readdirSync(outside.root)).toEqual([]);
	} finally {
		outside.remove();
	}
});
it("returns clarification separately and waits for the next attributable reply without consuming either", async () => {
	await open();
	const question = await register();
	const first = await client.mutate(client.responses.recordResponse.run({ ...input(question.id), type: "clarify" }));
	const controller = new AbortController();
	const waiting = Effect.runPromise(agentRequest("wait", { after: first.id, request: question.id, url: board.url }), { signal: controller.signal });
	const second = await client.mutate(client.responses.recordResponse.run(input(question.id, "response.second", "No.")));
	expect(await waiting).toMatchObject({ response: second });
	expect(second.response.recordedAt).toBeGreaterThan(first.response.recordedAt);
	expect(await Effect.runPromise(agentRequest("wait", { request: question.id, url: board.url }))).toMatchObject({ response: first });
	expect(questionFrom({ file: "plain.md", parsed: { body: "plain", bodyLine: 1, diagnostics: [], fields: {}, lines: {} } })).toBeUndefined();
});
it("shows ambiguous recorded history as unavailable instead of falsely saying no response exists", async () => {
	await open();
	const question = await register();
	notes.write("duplicate.md", readFileSync(join(notes.root, "responses", `${question.id}.md`), "utf8"));
	const response = await fetch(`${board.url}/_board/respond?item=investigation.model&request=review-model`);
	const html = await response.text();
	expect(response.status).toBe(409);
	expect(html).toContain("response history is unknown");
	expect(html).not.toContain("No response is recorded");
});
it("does not interpret malformed recorded feedback as an unanswered human request", async () => {
	await open();
	const question = await register();
	notes.write(
		"responses/response.broken.md",
		"---\nid: response.broken\nkind: response\nresponse: { type: answer }\n---\nActual feedback with incomplete provenance\n",
	);
	await expect(client.run(client.responses.responses.run({ question: question.id }))).rejects.toThrow("history cannot be established");
});
