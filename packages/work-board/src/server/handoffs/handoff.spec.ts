import { readFileSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { expect } from "vitest";
import { folder } from "#test/board.ts";
import { boardStory } from "#test/boardStory.ts";
import { outsideHandoffDirectory } from "#test/outsideHandoffDirectory.ts";
import { renderRemaining } from "#test/renderRemaining.tsx";
import { aHandoffTask } from "#test/storyTraits.ts";

const SOURCE =
	"---\r\nid: task.keyboard\r\nkind: task\r\nstatus: in-review\r\nnext_action: Verify focus before changing the implementation\r\ncriteria:\r\n  - id: focus\r\n    text: Escape returns focus to the opening control\r\n---\r\n# Keyboard focus\r\n\r\nKeep the source readable.\r\n";

boardStory.it(
	"records reviewed context through native RPC without changing the task or starting an agent",
	[aHandoffTask(SOURCE)],
	function* ({ notes, board, client, handoffDraft }) {
		const draft = yield* handoffDraft();
		const saved = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
		expect(saved.context).toBe(SOURCE);
		expect(saved.handoff.state).toBe("requested");
		expect(saved.prompt).toContain(JSON.stringify(join(notes.root, saved.file)));
		expect(readFileSync(join(notes.root, draft.source), "utf8")).toBe(SOURCE);
		const retry = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
		expect(retry).toEqual(saved);
		const page = yield* Effect.promise(() => fetch(`${board.url}/_board/handoff?item=task.keyboard`));
		expect(page.status).toBe(200);
		expect(yield* Effect.promise(() => renderRemaining(board.url, "/_board/handoff?item=task.keyboard"))).toContain("Copy tiny prompt");
	},
);

boardStory.it(
	"retains ordinary file acknowledgments and extra metadata through retry, source deletion and restart",
	[aHandoffTask(SOURCE)],
	function* ({ notes, board, client, restart, editFile, handoffDraft }) {
		const draft = yield* handoffDraft();
		const saved = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
		const raw = readFileSync(join(notes.root, saved.file), "utf8")
			.replace("state: requested", "state: acknowledged\n  by: agent-codex\n  note: Received; execution has not started.")
			.replace("kind: handoff", "kind: handoff\nagent_extra: ordinary file edits");
		editFile(saved.file, raw);
		unlinkSync(join(notes.root, draft.source));
		yield* Effect.promise(() =>
			expect
				.poll(() => client.run(client.handoffs.handoffs.run({ item: draft.item })))
				.toMatchObject({ records: [expect.objectContaining({ handoff: expect.objectContaining({ state: "acknowledged" }) })] }),
		);
		const retry = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
		expect(retry.handoff).toMatchObject({ by: "agent-codex", state: "acknowledged" });
		expect(readFileSync(join(notes.root, saved.file), "utf8")).toBe(raw);
		({ board, client } = yield* restart(true));
		const reading = yield* Effect.promise(() => client.run(client.handoffs.handoffs.run({ item: draft.item })));
		expect(reading.records[0]?.handoff.state).toBe("acknowledged");
		expect(reading.unknown).toEqual([]);
		const page = yield* Effect.promise(() => fetch(`${board.url}/_board/handoff?item=task.keyboard`));
		expect(page.status).toBe(200);
		expect(yield* Effect.promise(() => renderRemaining(board.url, "/_board/handoff?item=task.keyboard"))).toContain(
			"Earlier or unavailable reviewed source",
		);
	},
);

boardStory.it(
	"rejects changed sources, conflicting direction and moved record identities without replacing files",
	[aHandoffTask(SOURCE)],
	function* ({ notes, client, editFile, handoffDraft }) {
		const draft = yield* handoffDraft();
		editFile(draft.source, `${SOURCE}Changed by the agent.\n`);
		yield* Effect.promise(() => expect(client.mutate(client.handoffs.prepareHandoff.run(draft))).rejects.toThrow("source changed or moved"));
		editFile(draft.source, SOURCE);
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
	},
);

boardStory.it(
	"requires explicit local write opt-in and preserves the ordinary source on read-only pages",
	[aHandoffTask(SOURCE, "items/keyboard.md", false)],
	function* ({ notes, board, client, handoffDraft }) {
		const draft = yield* handoffDraft();
		yield* Effect.promise(() => expect(client.mutate(client.handoffs.prepareHandoff.run(draft))).rejects.toThrow("--responses"));
		expect(yield* Effect.promise(() => renderRemaining(board.url, "/_board/handoff?item=task.keyboard"))).toContain("Read-only mode");
		expect(readFileSync(join(notes.root, "items/keyboard.md"), "utf8")).toBe(SOURCE);
	},
);

boardStory.it(
	"reads explicit rejection and unavailability without inferring receipt from task status",
	[aHandoffTask(SOURCE)],
	function* ({ notes, client, editFile, handoffDraft }) {
		const draft = yield* handoffDraft();
		const saved = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
		const raw = readFileSync(join(notes.root, saved.file), "utf8");
		async function receipt() {
			return (await client.run(client.handoffs.handoffs.run({ item: draft.item }))).records[0]?.handoff.state;
		}
		for (const state of ["rejected", "unavailable"]) {
			editFile(saved.file, raw.replace("state: requested", `state: ${state}\n  by: agent-codex\n  note: Explicitly reported by the recipient.`));
			yield* Effect.promise(() => expect.poll(receipt).toBe(state));
		}
		expect(readFileSync(join(notes.root, draft.source), "utf8")).toBe(SOURCE);
	},
);

boardStory.it(
	"reports unreadable and ambiguous handoff history without inventing missing receipt",
	[aHandoffTask(SOURCE)],
	function* ({ notes, client, editFile, handoffDraft }) {
		const draft = yield* handoffDraft();
		const saved = yield* Effect.promise(() => client.mutate(client.handoffs.prepareHandoff.run(draft)));
		editFile("handoffs/broken.md", "---\nkind: handoff\nhandoff: [broken\n---\nFeedback\n");
		yield* Effect.promise(() =>
			expect
				.poll(() => client.run(client.handoffs.handoffs.run({ item: "task.keyboard" })))
				.toMatchObject({ unknown: expect.arrayContaining(["handoffs/broken.md"]) }),
		);
		editFile("duplicate.md", readFileSync(join(notes.root, saved.file), "utf8"));
		yield* Effect.promise(() =>
			expect
				.poll(() => client.run(client.handoffs.handoffs.run({ item: "task.keyboard" })))
				.toMatchObject({ records: [], unknown: expect.arrayContaining([saved.file]) }),
		);
	},
);

boardStory.it(
	"rejects a symlinked publication directory without writing to another folder",
	[aHandoffTask(SOURCE)],
	function* ({ notes, client, handoffDraft }) {
		const outside = folder({});
		try {
			outsideHandoffDirectory(notes.root, outside.root);
			const draft = yield* handoffDraft();
			yield* Effect.promise(() => expect(client.mutate(client.handoffs.prepareHandoff.run(draft))).rejects.toThrow());
		} finally {
			outside.remove();
		}
	},
);

boardStory.it("bounds reviewed context before preparing a handoff", [aHandoffTask(SOURCE)], function* ({ client, editFile }) {
	const remaining = 256 * 1024 + 1 - new TextEncoder().encode(SOURCE).length;
	const context = SOURCE + "界".repeat(Math.floor(remaining / 3)) + "x".repeat(remaining % 3);
	expect(context.length).toBeLessThan(256 * 1024);
	expect(new TextEncoder().encode(context).length).toBe(256 * 1024 + 1);
	editFile("items/keyboard.md", context);
	yield* Effect.promise(() => expect(client.run(client.handoffs.handoffSource.run({ item: "task.keyboard" }))).rejects.toThrow("256 KiB"));
});
