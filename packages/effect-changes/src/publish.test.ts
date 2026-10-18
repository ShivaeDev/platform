import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import type { Publish } from "#publish.ts";
import { type Change, type Current, change } from "#test/fakeDatabase.ts";
import { changes, configured, hasObserver } from "#test/kit.ts";

const failing: ReadonlyArray<readonly [string, string, Publish<Change, Current>]> = [
	["a failed Effect", "bus unavailable", () => Effect.fail(new Error("bus unavailable"))],
	["a defect", "listener threw", () => Effect.die(new Error("listener threw"))],
	[
		"a synchronous throw",
		"emit threw synchronously",
		() => {
			throw new Error("emit threw synchronously");
		},
	],
];

function logged(count: number, reason: string) {
	return {
		annotations: { changes: count, channel: "Test" },
		cause: expect.stringContaining(reason),
		level: "Error",
		message: [expect.stringContaining("the committed result stands")],
	};
}

function defect(exit: Exit.Exit<unknown, unknown>) {
	return Exit.isFailure(exit) && Cause.hasDies(exit.cause) ? Cause.pretty(exit.cause) : "no defect";
}

for (const [failure, reason, publish] of failing) {
	changes.it(
		`a sink that fails after commit with ${failure} is logged with its cause by default and the committed result stands`,
		[configured({ publish }), hasObserver()],
		function* ({ database, inTransaction, write, logs, observing, seen }) {
			yield* Effect.gen(function* () {
				const saved = yield* Effect.as(write(database, "row", change("ada"), change("bob")), "saved").pipe(inTransaction(database), observing);
				yield* write(database, "bare row", change("cyd"));
				expect(saved).toBe("saved");
				expect(database.committed).toEqual(["row", "bare row"]);
				expect(logs.entries).toEqual([logged(2, reason), logged(1, reason)]);
				expect(seen).toEqual(["Recorded ada:orders bob:orders", "Published ada:orders bob:orders"]);
			}).pipe(Effect.provide(logs.layer));
		},
	);

	changes.it(
		`with onPublishFailure set to die, a sink that fails with ${failure} raises a defect while the data stays committed`,
		[configured({ onPublishFailure: "die", publish })],
		function* ({ database, inTransaction, write, logs }) {
			yield* Effect.gen(function* () {
				const committed = yield* Effect.as(write(database, "row", change("ada")), "saved").pipe(inTransaction(database), Effect.exit);
				const bare = yield* write(database, "bare row", change("bob")).pipe(Effect.exit);
				expect([defect(committed), defect(bare)]).toEqual([expect.stringContaining(reason), expect.stringContaining(reason)]);
				expect(database.committed).toEqual(["row", "bare row"]);
				expect(logs.entries).toEqual([]);
			}).pipe(Effect.provide(logs.layer));
		},
	);
}
