import { readFileSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#client/client.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { outsideHandoffDirectory } from "#test/outsideHandoffDirectory.ts";

const SOURCE =
	"---\r\nid: task.keyboard\r\nkind: task\r\nstatus: in-review\r\nnext_action: Verify focus before changing the implementation\r\ncriteria:\r\n  - id: focus\r\n    text: Escape returns focus to the opening control\r\n---\r\n# Keyboard focus\r\n\r\nKeep the source readable.\r\n";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;

const open = Effect.fn("Test.open")(function* (enabled = true) {
	notes = folder({ "items/keyboard.md": SOURCE });
	board = yield* startBoard(notes.root, undefined, undefined, enabled);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
});

const input = Effect.fn("Test.input")(function* () {
	const preview = yield* Effect.promise(() => client.run(client.handoffs.handoffSource.run({ item: "task.keyboard" })));
	return {
		constraints: "Preserve no-JavaScript links.",
		goal: "Fix keyboard focus",
		id: "handoff.keyboard.1",
		item: preview.item,
		nextAction: "Inspect the current source and report browser evidence.",
		recipient: "agent-codex",
		revision: preview.reviewedRevision,
		source: preview.source,
	};
});

afterEach(() => {
	client?.registry.dispose();
	notes?.remove();
});

it.live("records reviewed context through native RPC without changing the task or starting an agent", function* () {
	yield* open();
	const draft = yield* input();
	const saved = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
	expect(saved.context).toBe(SOURCE);
	expect(saved.handoff.state).toBe("requested");
	expect(saved.prompt).toContain(JSON.stringify(join(notes.root, saved.file)));
	expect(readFileSync(join(notes.root, draft.source), "utf8")).toBe(SOURCE);
	const retry = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
	expect(retry).toEqual(saved);
	const page = yield* Effect.promise(() => fetch(`${board.url}/_board/handoff?item=task.keyboard`));
	expect(page.status).toBe(200);
	expect(yield* Effect.promise(() => page.text())).toContain("Copy tiny prompt");
});

it.live("retains ordinary file acknowledgments and extra metadata through retry, source deletion and restart", function* () {
	yield* open();
	const draft = yield* input();
	const saved = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
	const raw = readFileSync(join(notes.root, saved.file), "utf8")
		.replace("state: requested", "state: acknowledged\n  by: agent-codex\n  note: Received; execution has not started.")
		.replace("kind: handoff", "kind: handoff\nagent_extra: ordinary file edits");
	notes.write(saved.file, raw);
	unlinkSync(join(notes.root, draft.source));
	yield* Effect.promise(() =>
		expect
			.poll(() => client.run(client.handoffs.handoffs.run({ item: draft.item })))
			.toMatchObject({ records: [expect.objectContaining({ handoff: expect.objectContaining({ state: "acknowledged" }) })] }),
	);
	const retry = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
	expect(retry.handoff).toMatchObject({ by: "agent-codex", state: "acknowledged" });
	expect(readFileSync(join(notes.root, saved.file), "utf8")).toBe(raw);
	client.registry.dispose();
	yield* board.stop();
	board = yield* startBoard(notes.root, undefined, undefined, true);
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
	const reading = yield* Effect.promise(() => client.run(client.handoffs.handoffs.run({ item: draft.item })));
	expect(reading.records[0]?.handoff.state).toBe("acknowledged");
	expect(reading.unknown).toEqual([]);
	const page = yield* Effect.promise(() => fetch(`${board.url}/_board/handoff?item=task.keyboard`));
	expect(page.status).toBe(200);
	expect(yield* Effect.promise(() => page.text())).toContain("Earlier or unavailable reviewed source");
});

it.live("rejects changed sources, conflicting direction and moved record identities without replacing files", function* () {
	yield* open();
	const draft = yield* input();
	notes.write(draft.source, `${SOURCE}Changed by the agent.\n`);
	yield* Effect.promise(() => expect(client.mutate(client.handoffs.prepareHandoff.run(draft))).rejects.toThrow("source changed or moved"));
	notes.write(draft.source, SOURCE);
	const saved = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
	yield* Effect.promise(() =>
		expect(client.mutate(client.handoffs.prepareHandoff.run({ ...draft, goal: "Different direction" }))).rejects.toThrow("different direction"),
	);
	yield* Effect.promise(() =>
		expect(client.mutate(client.handoffs.prepareHandoff.run({ ...draft, recipient: "other-agent" }))).rejects.toThrow("different direction"),
	);
	renameSync(join(notes.root, saved.file), join(notes.root, "moved.md"));
	yield* Effect.promise(() => expect(client.mutate(client.handoffs.prepareHandoff.run(draft))).rejects.toThrow("moved"));
	expect(readFileSync(join(notes.root, "moved.md"), "utf8")).toContain("Fix keyboard focus");
});

it.live("requires explicit local write opt-in and preserves the ordinary source on read-only pages", function* () {
	yield* open(false);
	const draft = yield* input();
	yield* Effect.promise(() => expect(client.mutate(client.handoffs.prepareHandoff.run(draft))).rejects.toThrow("--responses"));
	const page = yield* Effect.promise(() => fetch(`${board.url}/_board/handoff?item=task.keyboard`));
	expect(yield* Effect.promise(() => page.text())).toContain("Read-only mode");
	expect(readFileSync(join(notes.root, "items/keyboard.md"), "utf8")).toBe(SOURCE);
});

it.live("reads explicit rejection and unavailability without inferring receipt from task status", function* () {
	yield* open();
	const draft = yield* input();
	const saved = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
	const raw = readFileSync(join(notes.root, saved.file), "utf8");
	async function receipt() {
		return (await client.run(client.handoffs.handoffs.run({ item: draft.item }))).records[0]?.handoff.state;
	}
	for (const state of ["rejected", "unavailable"]) {
		notes.write(saved.file, raw.replace("state: requested", `state: ${state}\n  by: agent-codex\n  note: Explicitly reported by the recipient.`));
		yield* Effect.promise(() => expect.poll(receipt).toBe(state));
	}
	expect(readFileSync(join(notes.root, draft.source), "utf8")).toBe(SOURCE);
});

it.live("reports unreadable and ambiguous handoff history without inventing missing receipt", function* () {
	yield* open();
	const draft = yield* input();
	const saved = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
	notes.write("handoffs/broken.md", "---\nkind: handoff\nhandoff: [broken\n---\nFeedback\n");
	yield* Effect.promise(() =>
		expect
			.poll(() => client.run(client.handoffs.handoffs.run({ item: "task.keyboard" })))
			.toMatchObject({ unknown: expect.arrayContaining(["handoffs/broken.md"]) }),
	);
	notes.write("duplicate.md", readFileSync(join(notes.root, saved.file), "utf8"));
	yield* Effect.promise(() =>
		expect
			.poll(() => client.run(client.handoffs.handoffs.run({ item: "task.keyboard" })))
			.toMatchObject({ records: [], unknown: expect.arrayContaining([saved.file]) }),
	);
});

it.live("rejects a symlinked publication directory without writing to another folder", function* () {
	yield* open();
	const outside = folder({});
	try {
		outsideHandoffDirectory(notes.root, outside.root);
		const draft = yield* input();
		yield* Effect.promise(() => expect(client.mutate(client.handoffs.prepareHandoff.run(draft))).rejects.toThrow());
	} finally {
		outside.remove();
	}
});

it.live("bounds reviewed context before preparing a handoff", function* () {
	yield* open();
	const remaining = 256 * 1024 + 1 - new TextEncoder().encode(SOURCE).length;
	const context = SOURCE + "界".repeat(Math.floor(remaining / 3)) + "x".repeat(remaining % 3);
	expect(context.length).toBeLessThan(256 * 1024);
	expect(new TextEncoder().encode(context).length).toBe(256 * 1024 + 1);
	notes.write("items/keyboard.md", context);
	yield* Effect.promise(() => expect(client.run(client.handoffs.handoffSource.run({ item: "task.keyboard" }))).rejects.toThrow("256 KiB"));
});
