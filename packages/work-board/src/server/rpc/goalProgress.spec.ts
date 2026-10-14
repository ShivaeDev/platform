import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#client/client.ts";
import { folder, startBoard } from "#test/board.ts";
import { goalsFixture } from "#test/goalsFixture.ts";
import { waitFor } from "#test/live.ts";

it.live("counts authored linked work, criterion claims and open asks through the typed goals query", function* () {
	const notes = yield* Effect.acquireRelease(
		Effect.sync(() => folder(goalsFixture())),
		(value) => Effect.sync(value.remove),
	);
	const board = yield* startBoard(notes.root);
	const client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
	const atom = client.api.goals.query();
	const release = client.registry.mount(atom);
	const result = yield* Effect.promise(() => client.read(atom));
	expect(result).toEqual({
		goals: [
			{
				counts: {},
				criteria: [{ counts: {}, evidence: 1, id: "untouched", linked: 0, text: "No linked work" }],
				id: "project.empty",
				linked: 0,
				openAsks: 0,
				status: "deferred",
				title: "Empty goal",
				unlinked: true,
			},
			{
				counts: { deferred: 1, done: 2, "not recorded": 1, planned: 1 },
				criteria: [
					{ counts: { done: 1, planned: 1 }, evidence: 2, id: "first", linked: 2, text: "First criterion" },
					{ counts: { deferred: 1 }, evidence: 1, id: "second", linked: 1, text: "Second criterion" },
				],
				id: "project.example",
				linked: 5,
				nextAction: "Review linked work",
				openAsks: 3,
				owner: "agent",
				status: "planned",
				title: "Example goal",
				unlinked: false,
			},
		],
	});
	notes.write("fifth.md", goalsFixture()["fifth.md"]?.replace("kind: task", "kind: task\nstatus: In Review") ?? "");
	yield* Effect.promise(() =>
		waitFor(() => {
			const updated = client.registry.get(atom);
			expect(updated._tag === "Success" && updated.value.goals.find((goal) => goal.id === "project.example")?.counts).toEqual({
				deferred: 1,
				done: 2,
				"In Review": 1,
				planned: 1,
			});
		}),
	);
	release();
});
