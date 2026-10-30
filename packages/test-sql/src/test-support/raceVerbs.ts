import { Effect, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import { raceWithLock } from "#raceWithLock.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";

type Lock = "row" | "table" | "advisory";

function takeLock(sql: SqlClient.SqlClient, lock: Lock) {
	switch (lock) {
		case "row":
			return sql`select id from items where id = 1 for update`;
		case "table":
			return sql`lock table items in share mode`;
		case "advisory":
			return sql`select pg_advisory_xact_lock(42)`;
	}
}

const claim = Effect.fnUntraced(function* (sql: SqlClient.SqlClient, name: string, guarded: boolean, lock: Lock) {
	if (name === "charlie") {
		yield* sql`select pg_stat_clear_snapshot()`.pipe(
			Effect.andThen(sql<{ waiting: number }>`select count(*)::integer as waiting from pg_stat_activity
				where datname = current_database() and wait_event_type = 'Lock'`),
			Effect.repeat({ schedule: Schedule.spaced("10 millis"), while: ([row]) => row?.waiting !== 2 }),
		);
	}
	if (lock === "advisory") {
		yield* sql`select pg_advisory_xact_lock(42)`;
	}
	if (!guarded) {
		const [row] = yield* sql<{ value: string }>`select value from items where id = 1`;
		if (row?.value !== "seed") {
			return yield* Effect.fail("full" as const);
		}
	}
	const changed = guarded
		? yield* sql`update items set value = ${name} where id = 1 and value = 'seed' returning value`
		: yield* sql`update items set value = ${name} where id = 1 returning value`;
	return changed.length > 0 ? name : yield* Effect.fail("full" as const);
});

export function raceVerbs(engine: DatabaseEngine) {
	let queued: readonly { query: string }[] = [];
	const raceWrites = Effect.fnUntraced(function* (guarded: boolean, lock: Lock) {
		const sql = yield* SqlClient.SqlClient;
		const recordWaiting = Effect.gen(function* () {
			yield* sql`select pg_stat_clear_snapshot()`;
			queued = yield* sql<{ query: string }>`select query from pg_stat_activity
				where datname = current_database() and wait_event_type = 'Lock'`;
		});
		const results = yield* raceWithLock({
			effects: ["alice", "bob", "charlie"].map((name) => sql.withTransaction(claim(sql, name, guarded, lock))),
			lock: Effect.gen(function* () {
				yield* takeLock(sql, lock);
				yield* Effect.addFinalizer(() => recordWaiting.pipe(Effect.orDie));
			}),
		});
		return yield* Effect.forEach(results, (result) =>
			Effect.fromResult(result).pipe(
				Effect.catchIf(
					(error) => error === "full",
					() => Effect.succeed("full" as const),
				),
			),
		);
	});
	return {
		queuedWrites: () => Effect.sync(() => queued.map(({ query }) => query)),
		raceWrites: (guarded: boolean, lock: Lock = "table") => engine.run(withIsolatedDatabase(raceWrites(guarded, lock))),
	};
}
