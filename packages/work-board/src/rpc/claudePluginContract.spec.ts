import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { goalProgressFixture, progressFleet } from "#test/goalProgressFixture.ts";
import { fleetReports } from "#test/storyTraits.ts";

const STARTED = 1000;
const NOW = 61_000;

const aLaunch = projectFiles(
	{
		"ask.md":
			"---\nid: decision.scope\nkind: question\nscope: task\nurgency: whenever\noptions:\n - label: Ship\n   description: Launch this week\n - label: Wait\n   description: Launch next month\nrecommended: Ship\nattention:\n - id: direction\n   kind: decision\n   state: open\n   response_from: [maintainer]\n   reason: Choose the launch scope\n   unblocks: [task.build]\n---\n# Launch scope",
		"build.md":
			"---\nid: task.build\nkind: task\nstatus: ready\nowner: claude\ncriteria:\n - id: proof\n   text: Show the page\nrelationships:\n - kind: implements\n   target: project.launch#page\n---\n# Build the page",
		"done.md": "---\nid: task.done\nkind: task\nstatus: done\nrelationships:\n - kind: implements\n   target: project.launch\n---\n# Write the plan",
		"goal.md": "---\nid: project.launch\nkind: goal\nstatus: draft\ncriteria:\n - id: page\n   text: A page exists\n---\n# Launch",
	},
	"a launch goal has done and planned work and an open decision",
);

const aBuildInFlight = fleetReports({
	completed: [],
	items: [
		{
			execution: {
				attempts: [{ fixingCi: false, id: "worker", role: "worker", sessionId: "worker", started: true, startedAt: STARTED, status: "running" }],
				mergeReady: false,
				question: false,
				step: "working",
			},
			prUrl: "https://github.com/example/project/pull/7",
			stage: "working",
			stageEnteredAt: STARTED,
			updatedAt: STARTED,
			workId: "task.build",
		},
		{ stage: "queued", stageEnteredAt: STARTED, updatedAt: STARTED, workId: "task.queued" },
	],
});

boardStory.it(
	"the plugin's board read shows the open decision, the build in flight and the launch goal's progress",
	[aLaunch, aBuildInFlight],
	function* ({ board, pluginSection }) {
		const flight = {
			agents: [
				{ id: "worker", role: "worker", state: "coding", turnMs: NOW - STARTED },
				{ id: "planned:reviewer", role: "reviewer", state: "not started yet", turnMs: null },
			],
			goal: { id: "project.launch", title: "Launch" },
			prUrl: "https://github.com/example/project/pull/7",
			stage: "working",
			title: "Build the page",
			workId: "task.build",
		};
		yield* outcomes([
			[
				"asks",
				() => pluginSection("asks", NOW),
				{
					items: [{ key: "open:task.build", title: "Build the page", url: `${board.url}/_board/item/decision.scope/#answer-card-direction` }],
					problem: null,
				},
			],
			[
				"flights",
				() => pluginSection("flights", NOW),
				{
					items: [flight],
					problem: null,
				},
			],
			[
				"goals",
				() => pluginSection("goals", NOW),
				{
					items: [
						{
							achieved: false,
							blocked: 0,
							done: 1,
							id: "project.launch",
							parked: 0,
							running: 1,
							scheduled: 0,
							standing: false,
							title: "Launch",
							total: 2,
						},
					],
					problem: null,
				},
			],
		]);
	},
);

boardStory.it(
	"the plugin's overview tool counts the waiting decision, the build in flight and the goal's progress",
	[aLaunch, aBuildInFlight],
	function* ({ pluginOverview }) {
		expect(yield* pluginOverview()).toMatchObject({
			fleet: { items: [{ goal: { id: "project.launch" }, workId: "task.build" }], state: "ready" },
			goals: { done: 1, total: 2 },
			needsYou: { count: 1, you: [{ id: "task.build", reason: "Choose the launch scope", title: "Build the page" }] },
		});
	},
);

boardStory.it(
	"the plugin's needs-you tool offers the decision's options and recommendation",
	[aLaunch, aBuildInFlight],
	function* ({ pluginNeedsYou }) {
		expect((yield* pluginNeedsYou()).you).toEqual([
			expect.objectContaining({
				id: "task.build",
				options: [expect.objectContaining({ label: "Ship" }), expect.objectContaining({ label: "Wait" })],
				recommended: "Ship",
			}),
		]);
	},
);

boardStory.it(
	"the plugin's item tool reads the build's criteria, relationships and Fleet stage",
	[aLaunch, aBuildInFlight],
	function* ({ pluginItem }) {
		expect(yield* pluginItem("task.build")).toMatchObject({
			criteria: [{ id: "proof", text: "Show the page" }],
			fleet: { item: { stage: "working", workId: "task.build" }, state: "ready" },
			id: "task.build",
			owner: "claude",
			relationships: [{ kind: "implements", target: "project.launch#page" }],
			status: "ready",
		});
	},
);

boardStory.it(
	"the plugin's board read carries every progress state and standing goals",
	[projectFiles(goalProgressFixture()), fleetReports(progressFleet())],
	function* ({ pluginGoal }) {
		yield* outcomes([
			[
				"progress",
				() => pluginGoal("goal.progress", NOW),
				{
					achieved: false,
					blocked: 4,
					done: 1,
					id: "goal.progress",
					parked: 5,
					running: 2,
					scheduled: 2,
					standing: false,
					title: "goal.progress",
					total: 14,
				},
			],
			["standing", () => pluginGoal("goal.standing", NOW), expect.objectContaining({ done: 1, standing: true, total: 1 })],
		]);
	},
);
