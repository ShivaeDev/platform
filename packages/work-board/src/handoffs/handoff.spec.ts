import { readFileSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import type { HandoffInput } from "#browser/handoffs/schema.ts";
import { type Folder, folder, type RunningBoard, startBoard } from "#test/board.ts";
import { outsideHandoffDirectory } from "#test/outsideHandoffDirectory.ts";

const SOURCE =
	"---\r\nid: task.keyboard\r\nkind: task\r\nstatus: in-review\r\nnext_action: Verify focus before changing the implementation\r\ncriteria:\r\n  - id: focus\r\n    text: Escape returns focus to the opening control\r\n---\r\n# Keyboard focus\r\n\r\nKeep the source readable.\r\n";
let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
async function open(enabled = true) {
	notes = folder({ "items/keyboard.md": SOURCE });
	board = await startBoard(notes.root, undefined, undefined, enabled);
	client = browserClient(board.url);
}
async function input(): Promise<HandoffInput> {
	const preview = await client.run(client.handoffs.handoffSource.run({ item: "task.keyboard" }));
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
}
afterEach(async () => {
	client?.registry.dispose();
	await board?.stop();
	notes?.remove();
});
it("records reviewed context through native RPC without changing the task or starting an agent", async () => {
	await open();
	const draft = await input();
	const saved = await client.mutate(client.handoffs.prepareHandoff.run(draft));
	expect(saved.context).toBe(SOURCE);
	expect(saved.handoff.state).toBe("requested");
	expect(saved.prompt).toContain(JSON.stringify(join(notes.root, saved.file)));
	expect(readFileSync(join(notes.root, draft.source), "utf8")).toBe(SOURCE);
	const retry = await client.mutate(client.handoffs.prepareHandoff.run(draft));
	expect(retry).toEqual(saved);
	const page = await fetch(`${board.url}/_board/handoff?item=task.keyboard`);
	expect(page.status).toBe(200);
	expect(await page.text()).toContain("Copy tiny prompt");
});
it("retains ordinary file acknowledgments and extra metadata through retry, source deletion and restart", async () => {
	await open();
	const draft = await input();
	const saved = await client.mutate(client.handoffs.prepareHandoff.run(draft));
	const raw = readFileSync(join(notes.root, saved.file), "utf8")
		.replace("state: requested", "state: acknowledged\n  by: agent-codex\n  note: Received; execution has not started.")
		.replace("kind: handoff", "kind: handoff\nagent_extra: ordinary file edits");
	notes.write(saved.file, raw);
	unlinkSync(join(notes.root, draft.source));
	await expect
		.poll(() => client.run(client.handoffs.handoffs.run({ item: draft.item })))
		.toMatchObject({ records: [expect.objectContaining({ handoff: expect.objectContaining({ state: "acknowledged" }) })] });
	const retry = await client.mutate(client.handoffs.prepareHandoff.run(draft));
	expect(retry.handoff).toMatchObject({ by: "agent-codex", state: "acknowledged" });
	expect(readFileSync(join(notes.root, saved.file), "utf8")).toBe(raw);
	client.registry.dispose();
	await board.stop();
	board = await startBoard(notes.root, undefined, undefined, true);
	client = browserClient(board.url);
	const reading = await client.run(client.handoffs.handoffs.run({ item: draft.item }));
	expect(reading.records[0]?.handoff.state).toBe("acknowledged");
	expect(reading.unknown).toEqual([]);
	const page = await fetch(`${board.url}/_board/handoff?item=task.keyboard`);
	expect(page.status).toBe(200);
	expect(await page.text()).toContain("Earlier or unavailable reviewed source");
});
it("rejects changed sources, conflicting direction and moved record identities without replacing files", async () => {
	await open();
	const draft = await input();
	notes.write(draft.source, `${SOURCE}Changed by the agent.\n`);
	await expect(client.mutate(client.handoffs.prepareHandoff.run(draft))).rejects.toThrow("source changed or moved");
	notes.write(draft.source, SOURCE);
	const saved = await client.mutate(client.handoffs.prepareHandoff.run(draft));
	await expect(client.mutate(client.handoffs.prepareHandoff.run({ ...draft, goal: "Different direction" }))).rejects.toThrow("different direction");
	await expect(client.mutate(client.handoffs.prepareHandoff.run({ ...draft, recipient: "other-agent" }))).rejects.toThrow("different direction");
	renameSync(join(notes.root, saved.file), join(notes.root, "moved.md"));
	await expect(client.mutate(client.handoffs.prepareHandoff.run(draft))).rejects.toThrow("moved");
	expect(readFileSync(join(notes.root, "moved.md"), "utf8")).toContain("Fix keyboard focus");
});
it("requires explicit local write opt-in and preserves the ordinary source on read-only pages", async () => {
	await open(false);
	await expect(client.mutate(client.handoffs.prepareHandoff.run(await input()))).rejects.toThrow("--responses");
	const page = await fetch(`${board.url}/_board/handoff?item=task.keyboard`);
	expect(await page.text()).toContain("Read-only mode");
	expect(readFileSync(join(notes.root, "items/keyboard.md"), "utf8")).toBe(SOURCE);
});
it("reads explicit rejection and unavailability without inferring receipt from task status", async () => {
	await open();
	const draft = await input();
	const saved = await client.mutate(client.handoffs.prepareHandoff.run(draft));
	const raw = readFileSync(join(notes.root, saved.file), "utf8");
	async function receipt() {
		return (await client.run(client.handoffs.handoffs.run({ item: draft.item }))).records[0]?.handoff.state;
	}
	for (const state of ["rejected", "unavailable"]) {
		notes.write(saved.file, raw.replace("state: requested", `state: ${state}\n  by: agent-codex\n  note: Explicitly reported by the recipient.`));
		await expect.poll(receipt).toBe(state);
	}
	expect(readFileSync(join(notes.root, draft.source), "utf8")).toBe(SOURCE);
});
it("reports unreadable and ambiguous handoff history without inventing missing receipt", async () => {
	await open();
	const saved = await client.mutate(client.handoffs.prepareHandoff.run(await input()));
	notes.write("handoffs/broken.md", "---\nkind: handoff\nhandoff: [broken\n---\nFeedback\n");
	await expect
		.poll(() => client.run(client.handoffs.handoffs.run({ item: "task.keyboard" })))
		.toMatchObject({ unknown: expect.arrayContaining(["handoffs/broken.md"]) });
	notes.write("duplicate.md", readFileSync(join(notes.root, saved.file), "utf8"));
	await expect
		.poll(() => client.run(client.handoffs.handoffs.run({ item: "task.keyboard" })))
		.toMatchObject({ records: [], unknown: expect.arrayContaining([saved.file]) });
});
it("rejects a symlinked publication directory without writing to another folder", async () => {
	await open();
	const outside = folder({});
	try {
		outsideHandoffDirectory(notes.root, outside.root);
		await expect(client.mutate(client.handoffs.prepareHandoff.run(await input()))).rejects.toThrow();
	} finally {
		outside.remove();
	}
});

it("bounds reviewed context before preparing a handoff", async () => {
	await open();
	const remaining = 256 * 1024 + 1 - new TextEncoder().encode(SOURCE).length;
	const context = SOURCE + "界".repeat(Math.floor(remaining / 3)) + "x".repeat(remaining % 3);
	expect(context.length).toBeLessThan(256 * 1024);
	expect(new TextEncoder().encode(context).length).toBe(256 * 1024 + 1);
	notes.write("items/keyboard.md", context);
	await expect(client.run(client.handoffs.handoffSource.run({ item: "task.keyboard" }))).rejects.toThrow("256 KiB");
});
