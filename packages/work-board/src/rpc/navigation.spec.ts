import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#browser/client.ts";
import { navigationHtml } from "#browser/navigation/html.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { navigationExpected } from "#test/navigationExpected.ts";
import { navigationFixture } from "#test/navigationFixture.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(() => {
	notes?.remove();
});
const open = Effect.fn("Test.open")(function* () {
	notes = folder(navigationFixture());
	board = yield* startBoard(notes.root, "packages/README.md");
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(resource) => Effect.sync(() => resource.registry.dispose()),
	);
});
it.live("returns the fixture tree, counts and current marking through native RPC and renders the same SSR sidebar", function* () {
	yield* open();
	const current = "packages/form/README.md";
	const data = yield* Effect.promise(() => client.run(client.api.navigation.run({ current })));
	expect(data).toEqual(navigationExpected());
	const response = yield* rawGet(board, "/packages/form/README.md");
	expect(response.status).toBe(200);
	expect(response.body).toContain(`<nav id="files" class="files" aria-label="Project files">${navigationHtml(data)}</nav>`);
});
it.live("marks the selected Fleet record and preserves the SSR group", function* () {
	yield* open();
	const data = yield* Effect.promise(() => client.read(client.api.navigation.query({ current: "responses/decision.md" })));
	expect(data.tree.active).toBe(false);
	expect(data.records).toMatchObject({ active: true, count: 1, files: [{ current: true, path: "responses/decision.md" }] });
	const response = yield* rawGet(board, "/responses/decision.md");
	expect(response.body).toContain(`<nav id="files" class="files" aria-label="Project files">${navigationHtml(data)}</nav>`);
});
