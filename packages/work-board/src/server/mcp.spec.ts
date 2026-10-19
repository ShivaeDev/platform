import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { codexResponse, githubObservations, health } from "#test/diagnostics.ts";
import { diagnosticsDaemon } from "#test/diagnosticsDaemon.ts";
import { goalsFixture } from "#test/goalsFixture.ts";
import { toolValue } from "#test/mcpClient.ts";

const project = projectFiles({
	...goalsFixture(),
	"ask.md":
		"---\nid: decision.first\nkind: decision\noptions:\n - label: Continue\n   description: Keep working\nrecommended: Continue\nattention:\n - id: direction\n   kind: decision\n   state: open\n   response_from: [maintainer]\n   reason: Choose the next step\n   unblocks: [task.first]\n---\n# Next step",
	"first.md":
		"---\nid: task.first\nkind: task\nstatus: planned\nowner: agent\ncriteria:\n - id: proof\n   text: Show proof\nrelationships:\n - kind: implements\n   target: project.example#first\n---\n# First task",
});

boardStory.it(
	"lists read-only tools and reads browser-computed board state through stdio",
	[project, deferredServing],
	function* ({ start, connectMcp }) {
		const daemon = yield* diagnosticsDaemon(
			() => ({
				codex: { observedAt: 100, state: "ready", value: codexResponse.rateLimits },
				fleet: { observedAt: 100, state: "ready", value: health },
				github: { observedAt: 100, state: "ready", value: githubObservations },
			}),
			0,
			() => ({
				completed: [],
				items: [
					{ prUrl: "https://github.com/example/project/pull/1", stage: "reviewing", stageEnteredAt: 0, updatedAt: 100, workId: "task.first" },
					{ stage: "validating", stageEnteredAt: 0, updatedAt: 100, workId: "task.second" },
				],
			}),
		);
		yield* start({ fleetPort: daemon.port });
		const client = yield* connectMcp();
		const listed = yield* client.list();
		expect(listed).toHaveProperty("tools.length", 3);
		expect(listed).toMatchObject({
			tools: expect.arrayContaining([
				expect.objectContaining({ annotations: expect.objectContaining({ readOnlyHint: true }), name: "board_overview" }),
				expect.objectContaining({ annotations: expect.objectContaining({ readOnlyHint: true }), name: "needs_you" }),
				expect.objectContaining({ annotations: expect.objectContaining({ readOnlyHint: true }), name: "item" }),
			]),
		});
		const overview = yield* client.call("board_overview");
		expect(overview.isError, JSON.stringify(overview.content) + client.diagnostics()).not.toBe(true);
		expect(toolValue(overview)).toMatchObject({
			fleet: {
				items: [
					{ prUrl: "https://github.com/example/project/pull/1", stage: "reviewing", workId: "task.first" },
					{ stage: "validating", workId: "task.second" },
				],
				state: "ready",
			},
			goals: {
				goals: expect.arrayContaining([
					expect.objectContaining({ counts: { done: 1, "in progress": 1, "needs you": 2, planned: 1 }, id: "project.example" }),
				]),
			},
			needsYou: { count: 4, you: expect.arrayContaining([expect.objectContaining({ id: "task.first", reason: "Choose the next step" })]) },
		});
		expect(toolValue(yield* client.call("needs_you"))).toMatchObject({
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
		expect(toolValue(yield* client.call("item", { id: "task.first" }))).toMatchObject({
			criteria: [{ id: "proof", text: "Show proof" }],
			fleet: { item: { stage: "reviewing" }, state: "ready" },
			id: "task.first",
			openDecisions: expect.arrayContaining([expect.objectContaining({ id: "decision.first/direction", open: true })]),
			owner: "agent",
			relationships: [{ kind: "implements", target: "project.example#first" }],
			status: "reviewing",
		});
	},
);

boardStory.it(
	"returns one actionable error for every tool when no board is running",
	[project, deferredServing],
	function* ({ notes: fixture, connectMcp }) {
		const client = yield* connectMcp();
		for (const name of ["board_overview", "needs_you", "item"]) {
			const result = yield* client.call(name, name === "item" ? { id: "task.first" } : {});
			expect(result).toEqual({
				content: [{ text: `No board answers in ${fixture.root}. Start one with: work-board '${fixture.root}'`, type: "text" }],
				isError: true,
			});
		}
	},
);

boardStory.it(
	"keeps Fleet unavailability and missing items explicit and notices a stopped board",
	[project, deferredServing],
	function* ({ notes: fixture, start, connectMcp, editFile }) {
		editFile(
			"ask.md",
			"---\nid: decision.first\nkind: decision\nattention:\n - id: direction\n   kind: decision\n   state: open\n   response_from: [maintainer]\n   reason: Choose the next step\n   unblocks: [task.first]\n---\n# Next step\n\n::::question{#direction select=one}\nChoose direction.\n\n:::option{#continue}\nContinue working.\n:::\n\n::::\n",
		);
		const board = yield* start({ fleetPort: null });
		const client = yield* connectMcp();
		const unavailable = { reason: "Fleet daemon is not configured for this Board", state: "unavailable" };
		expect(toolValue(yield* client.call("board_overview"))).toMatchObject({ fleet: unavailable });
		expect(toolValue(yield* client.call("needs_you"))).toMatchObject({
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
		expect(toolValue(yield* client.call("item", { id: "task.first" }))).toMatchObject({ fleet: unavailable, status: "needs-you" });
		expect(toolValue(yield* client.call("item", { id: "task.second" }))).toMatchObject({ fleet: unavailable, status: "planned" });
		const missing = yield* client.call("item", { id: "task.missing" });
		expect(missing.isError).toBe(true);
		expect(missing.content).toEqual([expect.objectContaining({ text: expect.stringContaining("missing") })]);
		yield* board.stop();
		expect(yield* client.call("board_overview")).toEqual({
			content: [{ text: `No board answers in ${fixture.root}. Start one with: work-board '${fixture.root}'`, type: "text" }],
			isError: true,
		});
	},
);
