import { Effect, Schema } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Conflict, NotFound } from "@shivaedev/platform/errors/taxonomy.ts";
import { Document } from "#browser/document/schema.ts";
import { browserClient } from "#client/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { documentSource } from "#test/documentSource.ts";
import { waitFor } from "#test/live.ts";
import { questionnaireAnswers } from "#test/questionnaire.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;

afterEach(() => {
	client?.registry.dispose();
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* () {
	notes = folder({ "checks.md": "# Checks", "nested/reading.md": documentSource, "nested/task.md": "# Task" });
	board = yield* startBoard(notes.root, "checks.md", undefined, true);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
});

it.live("returns Schema source, link targets, metadata and exact-context response records through HTTP RPC", function* () {
	yield* open();
	const result = yield* Effect.promise(() => client.run(client.api.document.run({ url: "/_board/item/investigation.choices/" })));
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
	expect(Object.keys(result).sort((left, right) => left.localeCompare(right))).toEqual([
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
	const registered = yield* Effect.promise(() =>
		client.mutate(client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision })),
	);
	yield* Effect.promise(() =>
		client.mutate(
			client.responses.recordResponse.run({
				answers: questionnaireAnswers,
				author: "reader",
				body: "Keep the full history.",
				id: "reply.reading",
				question: registered.id,
				type: "answer",
			}),
		),
	);
	yield* Effect.promise(async () =>
		waitFor(async () => {
			const fresh = await client.run(client.api.document.run({ url: "/nested/reading.md" }));
			expect(fresh.requests[0]?.responses?.[0]).toMatchObject({
				body: expect.stringContaining("Keep the full history."),
				response: { reviewedRevision: preview.reviewedRevision },
			});
		}),
	);
	expect((yield* Effect.promise(() => client.run(client.api.document.run({ url: "/" })))).file).toBe("checks.md");
	expect((yield* Effect.promise(() => fetch(`${board.url}/nested/reading.md`))).status).toBe(200);
});

it.live("refreshes query data when a referenced identity becomes ambiguous", function* () {
	yield* open();
	const atom = client.api.document.query({ url: "/nested/reading.md" });
	const release = client.registry.mount(atom);
	yield* Effect.promise(() => client.read(atom));
	notes.write("duplicate.md", "---\nid: investigation.choices\n---\n# Duplicate");
	yield* Effect.promise(() =>
		waitFor(() => {
			const read = client.registry.get(atom);
			expect(read._tag === "Success" && read.value.references["investigation.choices"] === undefined).toBe(true);
		}),
	);
	const fresh = yield* Effect.promise(() => client.read(atom));
	expect(fresh.identity).toBeUndefined();
	expect(fresh.questionActions).toEqual({});
	expect(fresh.requests[0]).toMatchObject({ open: false, unavailable: expect.stringContaining("ambiguous") });
	expect(fresh.requests[0]?.responses).toBeUndefined();
	release();
});

it.live("keeps malformed response history unavailable instead of reporting an empty history", function* () {
	yield* open();
	notes.write("responses/broken.md", "---\nkind: response\n---\n# Damaged record");
	yield* Effect.promise(async () =>
		waitFor(async () => {
			const result = await client.run(client.api.document.run({ url: "/nested/reading.md" }));
			expect(result.requests[0]?.unavailable).toContain("malformed");
			expect(result.requests[0]?.responses).toBeUndefined();
		}),
	);
});

it.live("rejects missing and duplicate document identities with typed read failures", function* () {
	yield* open();
	yield* Effect.promise(() => expect(client.run(client.api.document.run({ url: "/missing.md" }))).rejects.toBeInstanceOf(NotFound));
	notes.write("duplicate.md", "---\nid: investigation.choices\n---\n# Duplicate");
	yield* Effect.promise(async () =>
		waitFor(async () => {
			await expect(client.run(client.api.document.run({ url: "/_board/item/investigation.choices/" }))).rejects.toBeInstanceOf(Conflict);
		}),
	);
});
