import { Effect, PlatformError } from "effect";
import { expect } from "vitest";
import { boardFilesystem, boardStory, projectFiles } from "#test/boardStory.ts";
import { closedGoalPageFixture, goalFleetFixture } from "#test/goalPageFixture.ts";
import { linkedAsks } from "#test/linkedAsks.ts";
import { fleetReports } from "#test/storyTraits.ts";

boardStory.it("counts only eligible active Inbox rows for linked work", [linkedAsks], function* ({ rpc }) {
	const data = yield* rpc((client) => client("work-board.goals", undefined));
	const navigation = yield* rpc((client) => client("work-board.navigation", { current: "" }));
	expect(data.goals[0]?.openAsks).toBe(1);
	expect(navigation.inboxCount).toBe(2);
	expect(data.goals[0]?.openAsks).toBeLessThanOrEqual(navigation.inboxCount ?? 0);
});
for (const status of ["done", "dropped"]) {
	boardStory.it(
		`retains Fleet-aware progress for a ${status} project outside active navigation`,
		[projectFiles(closedGoalPageFixture(status)), fleetReports(goalFleetFixture())],
		function* ({ rpc }) {
			const data = yield* rpc((client) => client("work-board.goals", undefined));
			const goal = data.closedGoals.find((entry) => entry.id === "project.closed");
			expect(goal?.counts).toEqual({ deferred: 1, done: 1, draft: 2, dropped: 0, ready: 1 });
			expect(goal?.criteria[0]?.counts).toEqual({ deferred: 0, done: 0, draft: 1, dropped: 0, ready: 1 });
			expect(goal?.criteria[1]?.counts).toEqual({ deferred: 0, done: 0, draft: 0, dropped: 0, ready: 0 });
			expect(goal?.linked).toBe(5);
			expect(data.goals.map((entry) => entry.id)).toEqual(["project.example"]);
			expect(data.deferredGoals.map((entry) => entry.id)).toEqual(["project.empty"]);
			expect((yield* rpc((client) => client("work-board.navigation", { current: "" }))).counts.goals).toBe(1);
		},
	);
}

boardStory.it(
	"does not count goal asks while part of the workspace is unreadable",
	[
		linkedAsks,
		projectFiles({ "unreadable.md": "# Unreadable source" }),
		boardFilesystem((fs) => ({
			...fs,
			readFileString: (file, options) =>
				file.endsWith("unreadable.md")
					? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
					: fs.readFileString(file, options),
		})),
	],
	function* ({ rpc }) {
		const data = yield* rpc((client) => client("work-board.goals", undefined));
		expect(data.goals[0]?.openAsks).toBe(0);
		expect((yield* rpc((client) => client("work-board.navigation", { current: "" }))).inboxCount).toBeNull();
	},
);

for (const [status, group] of [
	["dropped", "dropped"],
	["ready", "ready"],
	["draft", "draft"],
	["ready", "ready"],
] as const) {
	boardStory.it(
		`counts ${status} linked work as ${group}`,
		[
			projectFiles({
				"goal.md": "---\nid: project.counting\nkind: goal\nstatus: ready\n---\n# Counting goal",
				"work.md": `---\nid: task.counted\nkind: task\nstatus: ${status}\nrelationships:\n - kind: implements\n   target: project.counting\n---\n# Counted work`,
			}),
		],
		function* ({ rpc }) {
			const data = yield* rpc((client) => client("work-board.goals", undefined));
			expect(data.goals.find((goal) => goal.id === "project.counting")?.counts).toEqual({
				deferred: 0,
				done: 0,
				draft: 0,
				dropped: 0,
				ready: 0,
				[group]: 1,
			});
		},
	);
}
