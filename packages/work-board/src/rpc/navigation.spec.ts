import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import { navigationHtml } from "#browser/navigation/html.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { navigationExpected } from "#test/navigationExpected.ts";
import { navigationFixture } from "#test/navigationFixture.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(async () => {
	client?.registry.dispose();
	await board?.stop();
	notes?.remove();
});

async function open() {
	notes = folder(navigationFixture());
	board = await startBoard(notes.root, "packages/README.md");
	client = browserClient(board.url);
}

it("returns the fixture tree, counts and current marking through native RPC and renders the same SSR sidebar", async () => {
	await open();
	const current = "packages/form/README.md";
	const data = await client.run(client.api.navigation.run({ current }));
	expect(data).toEqual(navigationExpected());
	const response = await rawGet(board, "/packages/form/README.md");
	expect(response.status).toBe(200);
	expect(response.body).toContain(`<nav id="files" class="files" aria-label="Project files">${navigationHtml(data)}</nav>`);
});

it("marks the selected Fleet record and preserves the SSR group", async () => {
	await open();
	const data = await client.read(client.api.navigation.query({ current: "responses/decision.md" }));
	expect(data.tree.active).toBe(false);
	expect(data.records).toMatchObject({ active: true, count: 1, files: [{ current: true, path: "responses/decision.md" }] });
	const response = await rawGet(board, "/responses/decision.md");
	expect(response.body).toContain(`<nav id="files" class="files" aria-label="Project files">${navigationHtml(data)}</nav>`);
});
