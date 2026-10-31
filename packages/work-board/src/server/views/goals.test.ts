import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { closedGoalPageFixture, goalFleetFixture } from "#test/goalPageFixture.ts";
import { linkedAsks } from "#test/linkedAsks.ts";
import { unreadableFile } from "#test/servingStoryTraits.ts";
import { fleetReports } from "#test/storyTraits.ts";

boardStory.it(
	"a goal counts only the active Inbox asks of its linked work, fewer than the Inbox shows",
	[linkedAsks],
	function* ({ goalCounts, navigationCounts }) {
		yield* outcomes({
			goal: [goalCounts("project.example"), expect.objectContaining({ openAsks: 1 })],
			navigation: [navigationCounts(), expect.objectContaining({ inbox: 2 })],
		});
	},
);

for (const status of ["done", "dropped"]) {
	boardStory.it(
		`a ${status} goal keeps its Fleet-aware progress while it leaves the active goals`,
		[projectFiles(closedGoalPageFixture(status)), fleetReports(goalFleetFixture())],
		function* ({ goalCounts, goalLists, navigationCounts }) {
			yield* outcomes({
				"closed goal": [
					goalCounts("project.closed"),
					expect.objectContaining({
						counts: { blocked: 1, done: 2, parked: 1, running: 1, scheduled: 0 },
						criteria: [
							{ blocked: 0, done: 1, parked: 0, running: 1, scheduled: 0 },
							{ blocked: 0, done: 0, parked: 0, running: 0, scheduled: 0 },
						],
						linked: 5,
					}),
				],
				"goal lists": [goalLists(), { active: ["project.example"], closed: ["project.closed"], deferred: ["project.empty"] }],
				navigation: [navigationCounts(), expect.objectContaining({ goals: 1 })],
			});
		},
	);
}

boardStory.it(
	"while part of the workspace is unreadable, goals count no asks and the Inbox count is unknown",
	[linkedAsks, projectFiles({ "unreadable.md": "# Unreadable source" }), unreadableFile("unreadable.md")],
	function* ({ goalCounts, navigationCounts }) {
		yield* outcomes({
			goal: [goalCounts("project.example"), expect.objectContaining({ openAsks: 0 })],
			navigation: [navigationCounts(), expect.objectContaining({ inbox: "unknown" })],
		});
	},
);

for (const [status, parked] of [
	["dropped", 0],
	["ready", 1],
	["draft", 1],
] as const) {
	boardStory.it(
		`${status} work linked to a goal counts as ${parked} parked and never as scheduled`,
		[
			projectFiles({
				"goal.md": "---\nid: project.counting\nkind: goal\nstatus: ready\n---\n# Counting goal",
				"work.md": `---\nid: task.counted\nkind: task\nstatus: ${status}\nrelationships: [{kind: implements, target: project.counting}]\n---\n# Counted work`,
			}),
		],
		function* ({ goalCounts }) {
			expect(yield* goalCounts("project.counting")).toMatchObject({ counts: { blocked: 0, done: 0, parked, running: 0, scheduled: 0 } });
		},
	);
}
