import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { navigationHtml } from "#browser/navigation/html.ts";
import { browserClient } from "#client/client.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
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
it.live("returns compact counts without a tree and keeps Library available in the fallback", function* () {
	yield* open();
	const data = yield* Effect.promise(() => client.run(client.api.navigation.run({ current: "packages/form/README.md" })));
	expect(data).toEqual({ counts: { goals: 0, library: 7, now: 0, system: expect.any(Number) }, home: { file: "packages/README.md" }, inboxCount: 1 });
	const response = yield* rawGet(board, "/packages/form/README.md");
	expect(response.body).toContain(navigationHtml(data));
	expect(response.body).not.toContain('data-key="folder:');
});
it.live("loads Fleet records only when Library requests them", function* () {
	yield* open();
	const hidden = yield* Effect.promise(() => client.run(client.api.library.run({})));
	expect(hidden.fleetCount).toBe(1);
	expect(hidden.files.some((file) => file.path === "responses/decision.md")).toBe(false);
	const shown = yield* Effect.promise(() => client.run(client.api.library.run({ showFleet: true })));
	expect(shown.files.some((file) => file.path === "responses/decision.md")).toBe(true);
});
