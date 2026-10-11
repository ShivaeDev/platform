import { Schema } from "effect";
import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import { Document } from "#browser/document/schema.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { documentSource } from "#test/documentSource.ts";
import { waitFor } from "#test/live.ts";
import { questionnaireAnswers } from "#test/questionnaire.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(async () => {
	client?.registry.dispose();
	await board?.stop();
	notes?.remove();
});
async function open() {
	notes = folder({ "checks.md": "# Checks", "nested/reading.md": documentSource, "nested/task.md": "# Task" });
	board = await startBoard(notes.root, "checks.md", undefined, true);
	client = browserClient(board.url);
}

it("returns Schema source, link targets, metadata and exact-context response records through HTTP RPC", async () => {
	await open();
	const result = await client.run(client.api.document.run({ url: "/_board/item/investigation.choices/" }));
	expect(Schema.is(Schema.toType(Document))(result)).toBe(true);
	expect(result.source).toContain("::::question");
	expect(result.source).not.toContain("id: investigation.choices");
	expect(result.metadata.kind).toBe("investigation");
	expect(result.identity).toBe("investigation.choices");
	expect(result.links["task.md"]).toBe("/nested/task.md");
	expect(result.links["../shots/review.png"]).toBe("/_board/attachment/shots/review.png");
	expect(result.references["investigation.choices"]).toBe("/_board/item/investigation.choices/");
	expect(result.questionActions["direction/display"]).toBe("/_board/respond?item=investigation.choices&request=direction");
	expect(result.questionActions["/checks"]).toBe(result.questionActions["direction/display"]);
	expect(Object.keys(result).sort()).toEqual([
		"diagnostics",
		"file",
		"identity",
		"links",
		"metadata",
		"modified",
		"questionActions",
		"references",
		"requests",
		"source",
		"unavailable",
		"writable",
	]);
	expect(result.requests[0]).toMatchObject({ id: "direction", open: true, preview: { context: documentSource }, responses: [] });
	const preview = result.requests[0]?.preview;
	if (!preview) {
		throw new Error("The open request has no preview");
	}
	const registered = await client.mutate(
		client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision }),
	);
	await client.mutate(
		client.responses.recordResponse.run({
			answers: questionnaireAnswers,
			author: "reader",
			body: "Keep the full history.",
			id: "reply.reading",
			question: registered.id,
			type: "answer",
		}),
	);
	await waitFor(async () => {
		const fresh = await client.run(client.api.document.run({ url: "/nested/reading.md" }));
		expect(fresh.requests[0]?.responses?.[0]).toMatchObject({
			body: expect.stringContaining("Keep the full history."),
			response: { reviewedRevision: preview.reviewedRevision },
		});
	});
	expect((await client.run(client.api.document.run({ url: "/" }))).file).toBe("checks.md");
	expect((await fetch(`${board.url}/nested/reading.md`)).status).toBe(200);
});

it("refreshes query data when a referenced identity becomes ambiguous", async () => {
	await open();
	const atom = client.api.document.query({ url: "/nested/reading.md" });
	const release = client.registry.mount(atom);
	await client.read(atom);
	notes.write("duplicate.md", "---\nid: investigation.choices\n---\n# Duplicate");
	await waitFor(() => {
		const read = client.registry.get(atom);
		expect(read._tag === "Success" && read.value.references["investigation.choices"] === undefined).toBe(true);
	});
	const fresh = await client.read(atom);
	expect(fresh.identity).toBeUndefined();
	expect(fresh.questionActions).toEqual({});
	expect(fresh.requests[0]).toMatchObject({ open: false, unavailable: expect.stringContaining("ambiguous") });
	expect(fresh.requests[0]?.responses).toBeUndefined();
	release();
});

it("keeps malformed response history unavailable instead of reporting an empty history", async () => {
	await open();
	notes.write("responses/broken.md", "---\nkind: response\n---\n# Damaged record");
	await waitFor(async () => {
		const result = await client.run(client.api.document.run({ url: "/nested/reading.md" }));
		expect(result.requests[0]?.unavailable).toContain("malformed");
		expect(result.requests[0]?.responses).toBeUndefined();
	});
});

it("rejects missing and duplicate document identities with typed read failures", async () => {
	await open();
	await expect(client.run(client.api.document.run({ url: "/missing.md" }))).rejects.toMatchObject({ operation: "document", status: 404 });
	notes.write("duplicate.md", "---\nid: investigation.choices\n---\n# Duplicate");
	await waitFor(async () => {
		await expect(client.run(client.api.document.run({ url: "/_board/item/investigation.choices/" }))).rejects.toMatchObject({
			operation: "document",
			status: 409,
		});
	});
});
