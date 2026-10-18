import { Effect } from "effect";
import { expect } from "vitest";
import { boardInit, readBoard } from "@shivaedev/work-board-plugin/board.ts";
import { answersTo, type Board, item, needsYou, overview } from "@shivaedev/work-board-plugin/boardTools.ts";
import { rpcInit } from "@shivaedev/work-board-plugin/rpc.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { fleetReports } from "#test/storyTraits.ts";

const STARTED = 1000;
const NOW = 61_000;

const aLaunch = projectFiles(
	{
		"ask.md":
			"---\nid: decision.scope\nkind: decision\noptions:\n - label: Ship\n   description: Launch this week\n - label: Wait\n   description: Launch next month\nrecommended: Ship\nattention:\n - id: direction\n   kind: decision\n   state: open\n   response_from: [maintainer]\n   reason: Choose the launch scope\n   unblocks: [task.build]\n---\n# Launch scope",
		"build.md":
			"---\nid: task.build\nkind: task\nstatus: planned\nowner: agent\ncriteria:\n - id: proof\n   text: Show the page\nrelationships:\n - kind: implements\n   target: project.launch#page\n---\n# Build the page",
		"done.md": "---\nid: task.done\nkind: task\nstatus: done\nrelationships:\n - kind: implements\n   target: project.launch\n---\n# Write the plan",
		"goal.md": "---\nid: project.launch\nkind: project\nstatus: planned\ncriteria:\n - id: page\n   text: A page exists\n---\n# Launch",
	},
	"a launch goal has done and planned work and an open decision",
);

const aBuildInFlight = fleetReports({
	completed: [],
	items: [
		{ prUrl: "https://github.com/example/project/pull/7", stage: "executing", stageEnteredAt: STARTED, updatedAt: STARTED, workId: "task.build" },
		{ stage: "prepared", stageEnteredAt: STARTED, updatedAt: STARTED, workId: "task.queued" },
	],
});

boardStory.it(
	"answers the Claude Code plugin's batch with what its parsers read as Needs you, In flight and Goals",
	[aLaunch, aBuildInFlight],
	function* ({ board, postToSocket }) {
		const reply = yield* postToSocket(boardInit("/project"));
		expect(readBoard(reply, "/project", NOW)).toEqual({
			asks: {
				items: [{ key: "open:task.build", title: "Build the page", url: `${board.url}/_board/item/decision.scope/#answer-card-direction` }],
				problem: null,
			},
			flights: {
				items: [
					{
						goal: { id: "project.launch", title: "Launch" },
						inStageMs: NOW - STARTED,
						prUrl: "https://github.com/example/project/pull/7",
						stage: "executing",
						title: "Build the page",
						workId: "task.build",
					},
				],
				problem: null,
			},
			goals: { items: [{ active: 1, done: 1, id: "project.launch", title: "Launch", total: 2 }], problem: null },
			kind: "ready",
		});
	},
);

boardStory.it(
	"answers the plugin's read-only tools with the items, documents and decisions they shape",
	[aLaunch, aBuildInFlight],
	function* ({ postToSocket }) {
		const ask: Board["ask"] = (requests) =>
			Effect.runPromise(postToSocket(rpcInit("/project", requests))).then((reply) => answersTo(requests, reply.text, "/project"));
		const tools = { ask, now: NOW };
		const [summary, waiting, card] = yield* Effect.promise(() => Promise.all([overview(tools), needsYou(tools), item(tools, "task.build")]));
		expect(summary).toMatchObject({
			fleet: { items: [{ goal: { id: "project.launch" }, workId: "task.build" }], state: "ready" },
			goals: { done: 1, total: 2 },
			needsYou: { count: 1, you: [{ id: "task.build", reason: "Choose the launch scope", title: "Build the page" }] },
		});
		expect(waiting.you).toEqual([
			expect.objectContaining({
				id: "task.build",
				options: [expect.objectContaining({ label: "Ship" }), expect.objectContaining({ label: "Wait" })],
				recommended: "Ship",
			}),
		]);
		expect(card).toMatchObject({
			criteria: [{ id: "proof", text: "Show the page" }],
			fleet: { item: { stage: "executing", workId: "task.build" }, state: "ready" },
			id: "task.build",
			owner: "agent",
			relationships: [{ kind: "implements", target: "project.launch#page" }],
			status: "executing",
		});
	},
);
