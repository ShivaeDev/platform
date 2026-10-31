import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { goalsFixture } from "#test/goalsFixture.ts";
import { boardWithoutFleet } from "#test/liveTraits.ts";

const fixture = goalsFixture();
const project = [projectFiles(fixture), boardWithoutFleet];
const counts = { blocked: 1, done: 2, parked: 2, running: 0, scheduled: 0 };

boardStory.it("the goals query counts a goal's linked work, its criterion claims and its eligible Inbox asks", project, function* ({ goalDetail }) {
	expect(yield* goalDetail("project.example")).toMatchObject({
		asks: [
			{ href: "/_board/item/decision.review/#answer-card-goal", reason: "Review goal" },
			{ href: "/_board/item/decision.review/#answer-card-task", reason: "Review task", title: "Fifth task" },
		],
		counts,
		criteria: [
			{ counts: { blocked: 0, done: 1, parked: 1, running: 0, scheduled: 0 }, evidence: 2, linked: 2 },
			{ counts: { blocked: 0, done: 0, parked: 1, running: 0, scheduled: 0 }, evidence: 1, linked: 1 },
		],
		linked: 5,
		openAsks: 2,
	});
});

boardStory.it("the goals query sorts goals into open, deferred and closed", project, function* ({ goalGroups }) {
	expect(yield* goalGroups()).toEqual({ closed: ["project.closed"], deferred: expect.arrayContaining(["project.empty"]), open: ["project.example"] });
});

boardStory.it("a goal without linked work is deferred and marked unlinked", project, function* ({ goalDetail }) {
	expect(yield* goalDetail("project.empty")).toMatchObject({ linked: 0, unlinked: true });
});

boardStory.it("the goals query lists every linked item with its modification time", project, function* ({ goalItems }) {
	expect(yield* goalItems()).toEqual({ ids: ["task.fifth", "task.first", "task.fourth", "task.second", "task.third"], modified: "dated" });
});

boardStory.it(
	"approving a parked task for Fleet moves it to scheduled in a mounted goals view",
	project,
	function* ({ editFile, mountedUpdate, mounts }) {
		expect(yield* mounts("goals")).toEqual({ counts, group: "open" });

		editFile("second.md", fixture["second.md"]?.replace("status: draft", "status: ready\nfleet: approved") ?? "");

		expect(yield* mountedUpdate("goals")).toEqual({ counts: { ...counts, parked: 1, scheduled: 1 }, group: "open" });
	},
);

boardStory.it(
	"closing a goal moves it to the closed goals with its counts, and navigation counts no open goals",
	project,
	function* ({ editFile, mountedUpdate, mounts, navigationCounts }) {
		expect(yield* mounts("goals")).toEqual({ counts, group: "open" });

		editFile("goal.md", fixture["goal.md"]?.replace("status: draft", "status: done") ?? "");

		yield* outcomes([
			["goals view update", () => mountedUpdate("goals"), { counts, group: "closed" }],
			["navigation afterwards", () => navigationCounts(), expect.objectContaining({ goals: 0 })],
		]);
	},
);
