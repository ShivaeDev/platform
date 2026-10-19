import { Effect } from "effect";
import { expect } from "vitest";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { FleetItems } from "#diagnostics/fleetItems.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { diagnosticsDaemon } from "#test/diagnosticsDaemon.ts";
import { unlistableWorkspace } from "#test/readTraits.ts";
import { fleetReports } from "#test/storyTraits.ts";

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
const project = projectFiles({
	"done.md": "---\nid: done\nkind: task\n---\n# Delivered task",
	"duplicate-too.md": "---\nid: duplicate\n---\n# Other duplicate",
	"duplicate.md": "---\nid: duplicate\n---\n# Duplicate",
	"one.md": "---\nid: one\nkind: task\nstatus: planned\n---\n# First task",
});
const missing = { cause: "Not configured for the story", observedAt: 0, state: "not-configured" as const };
function snapshot() {
	return { codex: missing, fleet: missing, github: missing };
}

boardStory.it(
	"joins daemon items by unique ID and retains missing documents and recent completions",
	[project, deferredServing],
	function* ({ start, rpc, story }) {
		let current = data;
		const daemon = yield* diagnosticsDaemon(snapshot, 0, () => current);
		yield* start({ fleetPort: daemon.port });
		const result = yield* rpc((client) => client("work-board.fleetItems", undefined));
		expect(result.state).toBe("ready");
		if (result.state !== "ready") {
			throw new Error("Fleet items were unavailable");
		}
		expect(result.items[0]?.document).toEqual({ file: "one.md", metadata: { id: "one", kind: "task", status: "planned" }, title: "First task" });
		expect(result.items[1]?.document).toBeNull();
		expect(result.items[2]?.document).toBeNull();
		expect(result.completed[0]).toMatchObject({ completedAt: 200, document: { file: "done.md", title: "Delivered task" } });
		current = { completed: [], items: [] };
		expect(yield* rpc((client) => client("work-board.fleetItems", undefined))).toEqual({ completed: [], items: [], state: "ready" });
		yield* daemon.stop();
		expect(yield* rpc((client) => client("work-board.fleetItems", undefined))).toEqual({
			reason: "Fleet isn't running, so agent work and its health are unknown.",
			startCommand: `work-fleet serve ${story.engine.notes.root} --port ${daemon.port}`,
			state: "unavailable",
		});
		expect((yield* rpc((client) => client("work-board.work", { url: "/_board/work" }))).items.length).toBeGreaterThan(0);
	},
);
boardStory.it("keeps an unconfigured Fleet explicit over Board RPC", [project, deferredServing], function* ({ start, rpc }) {
	yield* start({ fleetPort: null });
	expect(yield* rpc((client) => client("work-board.fleetItems", undefined))).toEqual({
		reason: "Fleet daemon is not configured for this Board",
		state: "unavailable",
	});
	expect((yield* rpc((client) => client("work-board.diagnostics", undefined))).sources.fleet).toMatchObject({
		cause: "Fleet daemon is not configured for this Board",
		state: "not-configured",
	});
});
boardStory.it(
	"reports an unreadable index as unavailable instead of a page error",
	[project, fleetReports(data), unlistableWorkspace()],
	function* ({ rpc }) {
		expect(yield* rpc((client) => client("work-board.fleetItems", undefined))).toEqual({
			reason: "Board documents could not be read for Fleet items",
			state: "unavailable",
		});
	},
);
boardStory.it("reports a Fleet service rejection as unavailable over Board HTTP RPC", [project, deferredServing], function* ({ start, rpc }) {
	const daemon = yield* diagnosticsDaemon(snapshot, 0, Effect.fail(new ServiceUnavailable({ message: "Fleet store unavailable" })));
	yield* start({ fleetPort: daemon.port });
	expect(yield* rpc((client) => client("work-board.fleetItems", undefined))).toEqual({
		reason: `Fleet daemon communication failed at 127.0.0.1:${daemon.port}`,
		state: "unavailable",
	});
});
