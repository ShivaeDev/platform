import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { firstDecision, goalsFixture } from "#test/goalsFixture.ts";
import { boardWithFleet, boardWithoutFleet } from "#test/liveTraits.ts";

const files = {
	...goalsFixture(),
	"ask.md": firstDecision("options:\n - label: Continue\n   description: Keep working\nrecommended: Continue\n"),
	"first.md":
		"---\nid: task.first\nkind: task\nstatus: draft\nowner: claude\ncriteria:\n - id: proof\n   text: Show proof\nrelationships:\n - kind: implements\n   target: project.example#first\n---\n# First task",
};
const project = projectFiles(files);
const withFleet = [
	project,
	boardWithFleet(() => ({
		completed: [],
		items: [
			{ prUrl: "https://github.com/example/project/pull/1", stage: "reviewing", stageEnteredAt: 0, updatedAt: 100, workId: "task.first" },
			{ stage: "reviewing", stageEnteredAt: 0, updatedAt: 100, workId: "task.second" },
		],
	})),
];
const unavailable = { reason: "Fleet isn't set up for this Board.", state: "unavailable" };
const NO_BOARD = "error: No board answers in the project folder. Start one with: work-board 'the project folder'";

boardStory.it("an agent connecting over MCP stdio finds three read-only tools", withFleet, function* ({ agentTools }) {
	expect(yield* agentTools()).toEqual([
		{ name: "board_overview", readOnly: true },
		{ name: "item", readOnly: true },
		{ name: "needs_you", readOnly: true },
	]);
});

boardStory.it(
	"board_overview reports the Fleet items, the goal counts and the Needs-you list the browser computes",
	withFleet,
	function* ({ agentReads }) {
		expect(yield* agentReads("board_overview")).toMatchObject({
			fleet: {
				items: [
					{ prUrl: "https://github.com/example/project/pull/1", stage: "reviewing", workId: "task.first" },
					{ stage: "reviewing", workId: "task.second" },
				],
				state: "ready",
			},
			goals: {
				goals: expect.arrayContaining([
					expect.objectContaining({ counts: { blocked: 1, done: 1, parked: 1, running: 2, scheduled: 0 }, id: "project.example" }),
				]),
			},
			needsYou: { count: 4, you: expect.arrayContaining([expect.objectContaining({ id: "task.first", reason: "Choose the next step" })]) },
		});
	},
);

boardStory.it("needs_you lists the open decision with its reason, options, recommendation and age", withFleet, function* ({ agentReads }) {
	expect(yield* agentReads("needs_you")).toMatchObject({
		you: expect.arrayContaining([
			expect.objectContaining({
				ageMs: expect.any(Number),
				id: "task.first",
				options: [{ description: "Keep working", label: "Continue" }],
				reason: "Choose the next step",
				recommended: "Continue",
			}),
		]),
	});
});

boardStory.it("item reports a task's criteria, Fleet stage, open decisions, owner, relationships and status", withFleet, function* ({ agentReads }) {
	expect(yield* agentReads("item", { id: "task.first" })).toMatchObject({
		criteria: [{ id: "proof", text: "Show proof" }],
		fleet: { item: { stage: "reviewing" }, state: "ready" },
		id: "task.first",
		openDecisions: expect.arrayContaining([expect.objectContaining({ id: "decision.first/direction", open: true })]),
		owner: "claude",
		relationships: [{ kind: "implements", target: "project.example#first" }],
		status: "draft",
	});
});

for (const [tool, args] of [
	["board_overview", {}],
	["needs_you", {}],
	["item", { id: "task.first" }],
] as const) {
	boardStory.it(
		`with no board running, ${tool} answers one error that says how to start the board`,
		[project, deferredServing],
		function* ({ agentReads }) {
			expect(yield* agentReads(tool, args)).toBe(NO_BOARD);
		},
	);
}

boardStory.it(
	"without Fleet, board_overview and item say Fleet isn't set up instead of failing",
	[project, boardWithoutFleet],
	function* ({ agentReads }) {
		yield* outcomes([
			[
				"a task Fleet has not seen",
				() => agentReads("item", { id: "task.second" }),
				expect.objectContaining({ fleet: expect.objectContaining(unavailable), status: "draft" }),
			],
			[
				"the decided task",
				() => agentReads("item", { id: "task.first" }),
				expect.objectContaining({ fleet: expect.objectContaining(unavailable), status: "draft" }),
			],
			["the overview", () => agentReads("board_overview"), expect.objectContaining({ fleet: expect.objectContaining(unavailable) })],
		]);
	},
);

boardStory.it(
	"needs_you lists a question's written prompts with their options",
	[
		projectFiles({
			...files,
			"ask.md": `${firstDecision("")}\n\n::::question{#direction select=one}\nChoose direction.\n\n:::option{#continue}\nContinue working.\n:::\n\n::::\n`,
		}),
		boardWithoutFleet,
	],
	function* ({ agentReads }) {
		expect(yield* agentReads("needs_you")).toMatchObject({
			you: expect.arrayContaining([
				expect.objectContaining({
					id: "task.first",
					options: [],
					prompts: [
						expect.objectContaining({
							id: "direction",
							mode: "one",
							options: [expect.objectContaining({ id: "continue", source: "Continue working." })],
						}),
					],
				}),
			]),
		});
	},
);

boardStory.it("item answers an error that names a missing item", [project, boardWithoutFleet], function* ({ agentReads }) {
	expect(yield* agentReads("item", { id: "task.missing" })).toEqual(expect.stringMatching(/^error: .*missing/u));
});

boardStory.it(
	"after the board stops, an agent's next read says no board answers",
	[project, boardWithoutFleet],
	function* ({ agentReads, boardStops }) {
		expect(yield* agentReads("board_overview")).toEqual(expect.objectContaining({ fleet: expect.objectContaining(unavailable) }));

		yield* boardStops();

		expect(yield* agentReads("board_overview")).toBe(NO_BOARD);
	},
);
