import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { browserClient } from "#client/client.ts";
import type { FleetItems } from "#diagnostics/fleetItems.ts";
import { type Folder, folder, startBoard } from "#test/board.ts";
import { codexResponse, githubResponse, health } from "#test/diagnostics.ts";
import { diagnosticsDaemon } from "#test/diagnosticsDaemon.ts";
import { fleetItems } from "./fleetItems.ts";

let notes: Folder;
afterEach(() => notes?.remove());

function snapshot() {
	return {
		codex: { observedAt: 100, state: "ready" as const, value: codexResponse.rateLimits },
		fleet: { observedAt: 100, state: "ready" as const, value: health },
		github: { observedAt: 100, state: "ready" as const, value: githubResponse.resources },
	};
}
const item = {
	attentionOwner: "maintainer" as const,
	prUrl: "https://example.invalid/pr/1",
	stage: "needs-human" as const,
	stageEnteredAt: 100,
	updatedAt: 200,
};
const data: FleetItems = {
	completed: [{ ...item, completedAt: 200, stage: "completed", workId: "done" }],
	items: [
		{ ...item, workId: "one" },
		{ ...item, workId: "missing" },
		{ ...item, workId: "duplicate" },
	],
};

function read(url: string) {
	return Effect.acquireUseRelease(
		Effect.sync(() => browserClient(url)),
		(client) => Effect.promise(() => client.run(client.api.fleetItems.run(undefined))),
		(client) => Effect.sync(() => client.registry.dispose()),
	);
}

it.live("Board RPC joins daemon items by ID, retains missing items and joins recent completions", function* () {
	let current = data;
	const daemon = yield* diagnosticsDaemon(snapshot, 0, () => current);
	notes = folder({
		"done.md": "---\nid: done\nkind: task\n---\n# Delivered task",
		"duplicate-too.md": "---\nid: duplicate\n---\n# Other duplicate",
		"duplicate.md": "---\nid: duplicate\n---\n# Duplicate",
		"one.md": "---\nid: one\nkind: task\nstatus: planned\n---\n# First task",
	});
	const board = yield* startBoard(notes.root, undefined, undefined, false, undefined, undefined, daemon.port);
	const result = yield* read(board.url);
	expect(result.state).toBe("ready");
	if (result.state !== "ready") {
		return yield* Effect.die("Expected Fleet items");
	}
	expect(result.items[0]).toEqual({
		...data.items[0],
		document: { file: "one.md", metadata: { id: "one", kind: "task", status: "planned" }, title: "First task" },
	});
	expect(result.items[1]).toEqual({ ...data.items[1], document: null });
	expect(result.items[2]?.document).toBeNull();
	expect(result.completed[0]).toMatchObject({ completedAt: 200, document: { file: "done.md", title: "Delivered task" } });
	current = { completed: [], items: [] };
	expect(yield* read(board.url)).toEqual({ completed: [], items: [], state: "ready" });
	yield* daemon.stop();
	expect(yield* read(board.url)).toEqual({
		reason: `No Fleet daemon is running at 127.0.0.1:${daemon.port}; start work-fleet serve <board-dir> --port ${daemon.port}`,
		state: "unavailable",
	});
	expect((yield* awaitBoardDocument(board.url)).items.length).toBeGreaterThan(0);
});

function awaitBoardDocument(url: string) {
	return Effect.acquireUseRelease(
		Effect.sync(() => browserClient(url)),
		(client) => Effect.promise(() => client.run(client.api.work.run({ url: "/_board/work" }))),
		(client) => Effect.sync(() => client.registry.dispose()),
	);
}

it.live("a Board with no configured Fleet returns unavailable over RPC", function* () {
	notes = folder({ "one.md": "# One" });
	const board = yield* startBoard(notes.root, undefined, undefined, false, undefined, undefined, null);
	expect(yield* read(board.url)).toEqual({ reason: "Fleet daemon is not configured for this Board", state: "unavailable" });
	const client = browserClient(board.url);
	try {
		const result = yield* Effect.promise(() => client.run(client.api.diagnostics.run(undefined)));
		expect(result.sources.fleet).toMatchObject({ cause: "Fleet daemon is not configured for this Board", state: "not-configured" });
	} finally {
		client.registry.dispose();
	}
});

it.live("a Board index failure becomes unavailable instead of a page error", function* () {
	const daemon = yield* diagnosticsDaemon(snapshot, 0, () => data);
	expect(yield* fleetItems({ fleetPort: daemon.port, index: Effect.fail("Synthetic index failure") })).toEqual({
		reason: "Board documents could not be read for Fleet items",
		state: "unavailable",
	});
});

it.live("a Fleet ServiceUnavailable rejection becomes unavailable over Board RPC", function* () {
	const daemon = yield* diagnosticsDaemon(snapshot, 0, Effect.fail(new ServiceUnavailable({ message: "Fleet store unavailable" })));
	notes = folder({ "one.md": "# One" });
	const board = yield* startBoard(notes.root, undefined, undefined, false, undefined, undefined, daemon.port);
	expect(yield* read(board.url)).toEqual({
		reason: `Fleet daemon communication failed at 127.0.0.1:${daemon.port}`,
		state: "unavailable",
	});
});
