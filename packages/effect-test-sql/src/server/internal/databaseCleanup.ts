import { Effect, type Exit, Fiber, Predicate, Schedule } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import { abandonedDatabase } from "./databaseOwner.ts";
import { administer } from "./databases.ts";

export const databaseCleanup = Effect.fn("PostgresTest.databaseCleanup")(function* (url: Parameters<typeof administer>[0]) {
	const pending: Fiber.Fiber<Exit.Exit<unknown, SqlError>>[] = [];
	function drop(name: string) {
		return administer(url, (admin) => admin`drop database if exists ${admin(name)} with (force)`).pipe(
			Effect.retry({
				schedule: Schedule.spaced("100 millis"),
				times: 300,
				while: (error) => Predicate.hasProperty(error.reason.cause, "code") && error.reason.cause.code === "53300",
			}),
		);
	}
	const awaitCleanup = Effect.suspend(() =>
		Effect.gen(function* () {
			const exits = yield* Effect.forEach([...pending], Fiber.join);
			yield* Effect.forEach(exits, (exit) => exit).pipe(Effect.orDie);
		}),
	);
	yield* Effect.addFinalizer(() => awaitCleanup);
	const leftovers = yield* administer(url, (admin) => admin<{ datname: string }>`select datname from pg_database`);
	for (const { datname } of leftovers) {
		if (abandonedDatabase(datname)) {
			yield* drop(datname);
		}
	}
	function release(name: string) {
		return Effect.gen(function* () {
			const previous = pending.at(-1);
			const ready = previous === undefined ? Effect.void : Fiber.join(previous);
			const fiber = yield* Effect.andThen(ready, Effect.exit(drop(name))).pipe(Effect.uninterruptible, Effect.forkDetach);
			pending.push(fiber);
		});
	}
	return { awaitCleanup, release };
});
