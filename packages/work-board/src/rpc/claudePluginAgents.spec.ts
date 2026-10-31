import { expect } from "vitest";
import { agentItems, workerTurn } from "#test/agentItems.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { fleetReports } from "#test/storyTraits.ts";

const project = projectFiles({ "task.md": "---\nid: task.build\nkind: task\n---\n# Build the pane" });
const runningWorker = { ...workerTurn, finishedAt: undefined, status: "running" };
const reviewer = { ...workerTurn, finishedAt: undefined, role: "reviewer" as const, sessionId: "reviewer", status: "running" };
const repair = { ...workerTurn, finishedAt: undefined, role: "repair" as const, status: "running" };
const unstarted = { ...workerTurn, finishedAt: undefined, started: false, startedAt: undefined, status: "submitting" };

for (const [situation, execution, states] of [
	["a worker turn is running", { attempts: [runningWorker] }, ["coding", "not started yet"]],
	["the worker finished and a reviewer is running", { attempts: [workerTurn, reviewer], step: "reviewing" }, ["done", "reviewing"]],
	["a repair turn answers the review", { attempts: [workerTurn, repair] }, ["addressing review", "not started yet"]],
	["a repair turn fixes CI", { attempts: [workerTurn, { ...repair, fixingCi: true }] }, ["fixing CI", "not started yet"]],
	[
		"the reviewer turn is still being submitted",
		{ attempts: [workerTurn, { ...reviewer, started: false, startedAt: undefined, status: "submitting" }], step: "reviewing" },
		["done", "not started yet"],
	],
	[
		"a second reviewer runs after the first finished",
		{
			attempts: [workerTurn, { ...reviewer, finishedAt: 61_000, status: "completed" }, { ...reviewer, sessionId: "second-reviewer" }],
			step: "reviewing",
		},
		["done", "done", "reviewing"],
	],
	["the work is validating", { step: "validating" }, ["waiting for CI", "not started yet"]],
	["the work waits to merge", { mergeReady: true, step: "waiting" }, ["waiting for merge", "not started yet"]],
	["the work waits on a question", { question: true, step: "waiting" }, ["waiting on an answer", "not started yet"]],
] as const) {
	boardStory.it(
		`when ${situation}, the plugin shows its agents as ${states.join(" and ")}`,
		[project, fleetReports(agentItems(execution))],
		function* ({ pluginAgentStates }) {
			expect(yield* pluginAgentStates(121_000)).toEqual([states]);
		},
	);
}

for (const step of ["queued", "waiting"]) {
	boardStory.it(
		`the plugin leaves out ${step} work whose only turn has not started`,
		[project, fleetReports(agentItems({ attempts: [unstarted], step }))],
		function* ({ pluginAgentStates }) {
			expect(yield* pluginAgentStates(121_000)).toEqual([]);
		},
	);
}

boardStory.it(
	"the plugin times a worker conversation by its latest turn only",
	[project, fleetReports(agentItems({ attempts: [workerTurn, { ...repair, startedAt: 121_000 }] }))],
	function* ({ pluginAgents }) {
		expect(yield* pluginAgents(181_000)).toEqual([
			[
				expect.objectContaining({ id: "worker", role: "worker", state: "addressing review", turnMs: 60_000 }),
				expect.objectContaining({ role: "reviewer", state: "not started yet", turnMs: null }),
			],
		]);
	},
);
