import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { FleetItems } from "#diagnostics/fleetItems.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { unlistableWorkspace } from "#test/readTraits.ts";
import { nestedProject } from "#test/servingTraits.ts";
import { fleetDaemon, rejectingFleetDaemon } from "#test/workspaceBoardTraits.ts";

const item = {
	attentionOwner: "maintainer" as const,
	prUrl: "https://example.invalid/pr/1",
	stage: "waiting" as const,
	stageEnteredAt: 100,
	updatedAt: 200,
};
const reported: FleetItems = {
	completed: [{ ...item, completedAt: 200, stage: "done", workId: "done" }],
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
	"one.md": "---\nid: one\nkind: task\nstatus: draft\n---\n# First task",
});

boardStory.it(
	"Fleet items join the document with their unique ID, and an item without one or with a duplicated ID keeps no document",
	[project, fleetDaemon(reported)],
	function* ({ fleetWork }) {
		expect(yield* fleetWork()).toMatchObject({
			completed: [expect.objectContaining({ completedAt: 200, document: expect.objectContaining({ file: "done.md", title: "Delivered task" }) })],
			items: [
				expect.objectContaining({
					document: { file: "one.md", metadata: { id: "one", kind: "task", status: "draft" }, title: "First task" },
					workId: "one",
				}),
				expect.objectContaining({ document: null, workId: "missing" }),
				expect.objectContaining({ document: null, workId: "duplicate" }),
			],
			state: "ready",
		});
	},
);

boardStory.it(
	"Fleet work follows the daemon when it finishes every item",
	[project, fleetDaemon(reported)],
	function* ({ fleetDaemonFinishesAll, fleetWork }) {
		expect(yield* fleetWork()).toMatchObject({ items: expect.arrayContaining([expect.objectContaining({ workId: "one" })]), state: "ready" });

		yield* fleetDaemonFinishesAll();

		expect(yield* fleetWork()).toEqual({ completed: [], items: [], state: "ready" });
	},
);

boardStory.it(
	"once the Fleet daemon stops, Fleet work is unavailable with a start command while Work still lists the tasks",
	[project, fleetDaemon(reported)],
	function* ({ fleetDaemonStops, fleetStartCommand, fleetWork, workRowIds }) {
		yield* fleetDaemonStops();

		yield* outcomes({
			"fleet work": [
				fleetWork(),
				expect.objectContaining({ authored: [], reason: "Fleet isn't running, so agent work and its health are unknown.", state: "unavailable" }),
			],
			"start command": [fleetStartCommand(), expect.stringMatching(/^npx @shivaedev\/work-fleet serve <parent>\/[^ ']+ --port <fleet port>$/u)],
			"work rows": [workRowIds("/_board/work"), expect.arrayContaining(["one"])],
		});
	},
);

boardStory.it(
	"the start command quotes a Board folder name with a space and an apostrophe",
	[nestedProject("Team's notes"), fleetDaemon(reported)],
	function* ({ fleetDaemonStops, fleetStartCommand }) {
		yield* fleetDaemonStops();

		expect(yield* fleetStartCommand()).toBe("npx @shivaedev/work-fleet serve '<parent>/Team'\\''s notes' --port <fleet port>");
	},
);

boardStory.it(
	"a Board without Fleet says Fleet isn't set up, in Fleet work and in diagnostics",
	[project, deferredServing],
	function* ({ fleetSource, fleetWork, start }) {
		yield* start({ fleetPort: null });

		yield* outcomes({
			"fleet source": [fleetSource(), expect.objectContaining({ cause: "Fleet isn't set up for this Board.", state: "not-configured" })],
			"fleet work": [fleetWork(), { authored: [], reason: "Fleet isn't set up for this Board.", state: "unavailable" }],
		});
	},
);

boardStory.it(
	"an unreadable index makes Fleet work unavailable instead of failing the page",
	[project, fleetDaemon(reported), unlistableWorkspace()],
	function* ({ fleetWork }) {
		expect(yield* fleetWork()).toEqual({ reason: "Board documents could not be read for Fleet items", state: "unavailable" });
	},
);

boardStory.it(
	"a Fleet daemon that rejects the request makes Fleet work unavailable, naming its port",
	[project, rejectingFleetDaemon("Fleet store unavailable")],
	function* ({ fleetWork }) {
		expect(yield* fleetWork()).toEqual({
			authored: [],
			reason: expect.stringMatching(/^Fleet on port \d+ didn't answer as expected, so agent work and its health are unknown\.$/u),
			state: "unavailable",
		});
	},
);

boardStory.it(
	"without Fleet, Work lists the ready tasks as in progress from their own files",
	[
		projectFiles({
			"active.md": "---\nid: task.active\nkind: task\nstatus: ready\nowner: codex\n---\n# Ready task",
			"delivering.md": "---\nid: task.delivering\nkind: task\nstatus: ready\n---\n# Delivering task",
			"done.md": "---\nid: task.done\nkind: task\nstatus: done\n---\n# Done task",
			"dropped.md": "---\nid: task.dropped\nkind: task\nstatus: dropped\n---\n# Dropped task",
			"merge.md": "---\nid: task.merge\nkind: task\nstatus: ready\n---\n# Merge task",
			"planned.md": "---\nid: task.draft\nkind: task\nstatus: draft\n---\n# Draft task",
			"project.md": "---\nid: project.running\nkind: goal\nstatus: ready\n---\n# Running goal",
			"review.md": "---\nid: task.review\nkind: task\nstatus: ready\n---\n# Reviewed task",
		}),
		deferredServing,
	],
	function* ({ fleetWork, start }) {
		yield* start({ fleetPort: null });

		expect(yield* fleetWork()).toEqual({
			authored: [
				{ file: "active.md", status: "ready", title: "Ready task", workId: "task.active" },
				{ file: "delivering.md", status: "ready", title: "Delivering task", workId: "task.delivering" },
				{ file: "merge.md", status: "ready", title: "Merge task", workId: "task.merge" },
				{ file: "review.md", status: "ready", title: "Reviewed task", workId: "task.review" },
			],
			reason: "Fleet isn't set up for this Board.",
			state: "unavailable",
		});
	},
);
