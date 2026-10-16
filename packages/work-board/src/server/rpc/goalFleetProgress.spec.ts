import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#client/client.ts";
import { folder, startBoard } from "#test/board.ts";
import { diagnosticsDaemon } from "#test/diagnosticsDaemon.ts";
import { goalFleetFixture, goalPageFixture } from "#test/goalPageFixture.ts";

it.live.each(["executing", "reviewing", "needs-human"] as const)("counts Fleet %s as in progress through the goals RPC", function* (stage) {
	const notes = yield* Effect.acquireRelease(
		Effect.sync(() => folder(goalPageFixture())),
		(value) => Effect.sync(value.remove),
	);
	const missing = { cause: "Not configured for fixture", observedAt: 0, state: "not-configured" as const };
	const fleet = goalFleetFixture(stage);
	const daemon = yield* diagnosticsDaemon(
		() => ({ codex: missing, fleet: missing, github: missing }),
		0,
		() => fleet,
	);
	const board = yield* startBoard(notes.root, undefined, undefined, false, undefined, undefined, daemon.port);
	const client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
	const result = yield* Effect.promise(() => client.read(client.api.goals.query()));
	const goal = result.goals.find((entry) => entry.id === "project.example");
	expect(goal?.counts).toEqual({ done: 2, "in progress": 1, planned: 2 });
	expect(goal?.criteria[0]?.counts).toEqual({ done: 1, "in progress": 1, planned: 0 });
	expect(goal?.criteria[1]?.counts).toEqual({ done: 0, "in progress": 0, planned: 0 });
});
