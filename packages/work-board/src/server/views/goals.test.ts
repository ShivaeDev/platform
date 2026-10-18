import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
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
for (const status of ["closed", "done", "superseded", "completed", "cancelled", "canceled", "resolved", "released"]) {
	boardStory.it(
		`retains Fleet-aware progress for a ${status} project outside active navigation`,
		[projectFiles(closedGoalPageFixture(status)), fleetReports(goalFleetFixture())],
		function* ({ rpc }) {
			const data = yield* rpc((client) => client("work-board.goals", undefined));
			const goal = data.closedGoals.find((entry) => entry.id === "project.closed");
			expect(goal?.counts).toEqual({ done: 3, "in progress": 1, planned: 2 });
			expect(goal?.criteria[0]?.counts).toEqual({ done: 2, "in progress": 1, planned: 0 });
			expect(goal?.criteria[1]?.counts).toEqual({ done: 0, "in progress": 0, planned: 0 });
			expect(goal?.linked).toBe(6);
			expect(data.goals.map((entry) => entry.id)).toEqual(["project.empty", "project.example"]);
			expect((yield* rpc((client) => client("work-board.navigation", { current: "" }))).counts.goals).toBe(2);
		},
	);
}
