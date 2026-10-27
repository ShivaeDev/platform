import { expect } from "vitest";
import { boardInit, readBoard } from "@shivaedev/work-board-plugin/board.ts";
import { agentItems, workerTurn } from "#test/agentItems.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { fleetReports } from "#test/storyTraits.ts";

const project = projectFiles({ "task.md": "---\nid: task.build\nkind: task\n---\n# Build the pane" });
const reviewer = { ...workerTurn, finishedAt: undefined, role: "reviewer" as const, sessionId: "reviewer", status: "running" };
const cases = [
	{ execution: { attempts: [{ ...workerTurn, finishedAt: undefined, status: "running" }] }, states: ["coding", "not started yet"] },
	{ execution: { attempts: [workerTurn, reviewer], step: "reviewing" }, states: ["done", "reviewing"] },
	{
		execution: { attempts: [workerTurn, { ...workerTurn, finishedAt: undefined, role: "repair" as const, status: "running" }] },
		states: ["addressing review", "not started yet"],
	},
	{
		execution: { attempts: [workerTurn, { ...workerTurn, finishedAt: undefined, fixingCi: true, role: "repair" as const, status: "running" }] },
		states: ["fixing CI", "not started yet"],
	},
	{
		execution: { attempts: [workerTurn, { ...reviewer, started: false, startedAt: undefined, status: "submitting" }], step: "reviewing" },
		states: ["done", "not started yet"],
	},
	{
		execution: {
			attempts: [workerTurn, { ...reviewer, finishedAt: 61_000, status: "completed" }, { ...reviewer, sessionId: "second-reviewer" }],
			step: "reviewing",
		},
		states: ["done", "done", "reviewing"],
	},
	{ execution: { step: "validating" }, states: ["waiting for CI", "not started yet"] },
	{ execution: { mergeReady: true, step: "waiting" }, states: ["waiting for merge", "not started yet"] },
	{ execution: { question: true, step: "waiting" }, states: ["waiting on an answer", "not started yet"] },
];
for (const { execution, states } of cases) {
	boardStory.it(
		`exposes ${states.join(" and ")} from Fleet attempts to the plugin`,
		[project, fleetReports(agentItems(execution))],
		function* ({ postToSocket, rpc }) {
			const data = yield* rpc((client) => client("work-board.fleetItems", undefined));
			expect(data).toMatchObject({ items: [{ agents: states.map((state) => ({ state })), inFlight: true }] });
			const result = readBoard(yield* postToSocket(boardInit("/project")), "/project", 121_000);
			if (result.kind !== "ready") {
				throw new Error("Expected a readable Board");
			}
			expect(result.flights.items[0]?.agents.map((agent) => agent.state)).toEqual(states);
		},
	);
}

for (const step of ["queued", "waiting"]) {
	boardStory.it(
		`excludes ${step} work without a started attempt`,
		[
			project,
			fleetReports(
				agentItems({ attempts: [{ ...workerTurn, finishedAt: undefined, started: false, startedAt: undefined, status: "submitting" }], step }),
			),
		],
		function* ({ postToSocket }) {
			const result = readBoard(yield* postToSocket(boardInit("/project")), "/project", 121_000);
			expect(result).toMatchObject({ flights: { items: [] } });
		},
	);
}

boardStory.it(
	"times only the latest turn of a worker conversation",
	[
		project,
		fleetReports(
			agentItems({ attempts: [workerTurn, { ...workerTurn, finishedAt: undefined, role: "repair", startedAt: 121_000, status: "running" }] }),
		),
	],
	function* ({ postToSocket }) {
		const result = readBoard(yield* postToSocket(boardInit("/project")), "/project", 181_000);
		expect(result).toMatchObject({
			flights: {
				items: [
					{
						agents: [
							{ id: "worker", role: "worker", state: "addressing review", turnMs: 60_000 },
							{ role: "reviewer", state: "not started yet", turnMs: null },
						],
					},
				],
			},
		});
	},
);
