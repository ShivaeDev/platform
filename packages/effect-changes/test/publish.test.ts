import { Cause, Effect, Exit } from "effect";
import { expect, it } from "vitest";
import type { Publish } from "#index.ts";
import { type Change, type Current, captureLogs, change, harness, makeDatabase } from "#test/support/fake-database.ts";

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

const logged = (changes: number, reason: string) => ({
	annotations: { changes, channel: "Test" },
	cause: expect.stringContaining(reason),
	level: "Error",
	message: [expect.stringContaining("the committed result stands")],
});

const defect = (exit: Exit.Exit<unknown, unknown>) => (Exit.isFailure(exit) && Cause.hasDies(exit.cause) ? Cause.pretty(exit.cause) : "no defect");

it.each(failing)(
	"a sink that fails after commit with %s is logged with its cause by default and the committed result stands",
	(_, reason, publish) => {
		const logs = captureLogs();
		return Effect.runPromise(
			Effect.gen(function* () {
				const { inTransaction, write } = harness({ publish });
				const database = makeDatabase("main");
				const saved = yield* Effect.as(write(database, "row", change("ada"), change("bob")), "saved").pipe(inTransaction(database));
				yield* write(database, "bare row", change("cyd"));
				expect(saved).toBe("saved");
				expect(database.committed).toEqual(["row", "bare row"]);
				expect(logs.entries).toEqual([logged(2, reason), logged(1, reason)]);
			}).pipe(Effect.provide(logs.layer)),
		);
	},
);

it.each(failing)(
	"with onPublishFailure set to die, a sink that fails with %s raises a defect while the data stays committed",
	(_, reason, publish) => {
		const logs = captureLogs();
		return Effect.runPromise(
			Effect.gen(function* () {
				const { inTransaction, write } = harness({ onPublishFailure: "die", publish });
				const database = makeDatabase("main");
				const committed = yield* Effect.as(write(database, "row", change("ada")), "saved").pipe(inTransaction(database), Effect.exit);
				const bare = yield* write(database, "bare row", change("bob")).pipe(Effect.exit);
				expect([defect(committed), defect(bare)]).toEqual([expect.stringContaining(reason), expect.stringContaining(reason)]);
				expect(database.committed).toEqual(["row", "bare row"]);
				expect(logs.entries).toEqual([]);
			}).pipe(Effect.provide(logs.layer)),
		);
	},
);
