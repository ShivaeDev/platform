import { Effect, Result, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { raceWithLock } from "#raceWithLock.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { failureOf } from "./outcome.ts";

export type Lock = "row" | "table" | "advisory";

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

// PostgreSQL signals nothing when a session starts waiting on a lock, so the kit polls its lock view.
function afterWaiting(sql: SqlClient.SqlClient, count: number) {
	return sql`select pg_stat_clear_snapshot()`.pipe(
		Effect.andThen(sql<{ waiting: number }>`select count(*)::integer as waiting from pg_stat_activity
			where datname = current_database() and wait_event_type = 'Lock'`),
		Effect.repeat({ schedule: Schedule.spaced("10 millis"), while: ([row]) => row?.waiting !== count }),
	);
}

const anotherSessionWaits = Effect.fnUntraced(function* (sql: SqlClient.SqlClient) {
	const connection = yield* sql.reserve;
	yield* Effect.forkScoped(connection.executeRaw("select pg_advisory_xact_lock(42)", []));
	yield* afterWaiting(sql, 1);
});

const claim = Effect.fnUntraced(function* (sql: SqlClient.SqlClient, name: string, guarded: boolean, lock: Lock, waitersAhead: number) {
	if (name === "charlie") {
		yield* afterWaiting(sql, waitersAhead + 2);
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

function claimFailure(failure: unknown) {
	return typeof failure === "string" ? failure : failureOf(failure);
}

function waitingOn(query: string) {
	return query.includes("pg_advisory_xact_lock") ? "the advisory lock" : "the items update";
}

export function raceVerbs(engine: DatabaseEngine, story: Story<DatabaseEngine>) {
	let waiting: readonly string[] = [];
	let results: readonly string[] = [];
	let seen: readonly string[] = [];
	let read = "";
	const race = Effect.fnUntraced(function* (guarded: boolean, lock: Lock, outsider: boolean) {
		const sql = yield* SqlClient.SqlClient;
		const recordWaiting = Effect.gen(function* () {
			yield* sql`select pg_stat_clear_snapshot()`;
			const rows = yield* sql<{ query: string }>`select query from pg_stat_activity
				where datname = current_database() and wait_event_type = 'Lock'`;
			waiting = rows.map(({ query }) => waitingOn(query));
		});
		const raced = yield* raceWithLock({
			effects: ["alice", "bob", "charlie"].map((name) => sql.withTransaction(claim(sql, name, guarded, lock, outsider ? 1 : 0))),
			lock: Effect.gen(function* () {
				yield* takeLock(sql, lock);
				if (outsider) {
					yield* anotherSessionWaits(sql);
				}
				yield* Effect.addFinalizer(() => recordWaiting.pipe(Effect.orDie));
			}),
		});
		results = raced.map((result) => (Result.isSuccess(result) ? result.success : claimFailure(result.failure)));
	});
	const secondTestWrites = Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* raceWithLock({
			effects: [
				withTestTransaction(
					Effect.gen(function* () {
						yield* sql`update items set value = 'second' where id = 1`;
						seen = yield* Effect.map(sql<{ value: string }>`select value from items order by id`, (rows) => rows.map(({ value }) => value));
					}),
				),
			],
			lock: sql`update items set value = 'first' where id = 1`,
		});
	});
	const contenderReads = Effect.fnUntraced(function* (release: "commit" | undefined) {
		const sql = yield* SqlClient.SqlClient;
		const [answer] = yield* raceWithLock({
			effects: [Effect.map(sql<{ value: string }>`select value from items where id = 1 for update`, ([row]) => row?.value ?? "no row")],
			lock: sql`update items set value = 'holder' where id = 1`,
			...(release === undefined ? {} : { release }),
		});
		read = answer !== undefined && Result.isSuccess(answer) ? answer.success : "no answer";
	});
	return {
		contenderReadsHeldRow: (release?: "commit") => {
			story.tell(`a contender waits to read the row a holder updated, and the holder releases with ${release ?? "its default rollback"}`);
			return engine.run(withIsolatedDatabase(contenderReads(release)));
		},
		contenderSaw: () => Effect.sync(() => read),
		race: (contenders: { readonly lock: Lock; readonly writes: "guarded" | "unguarded" }) => {
			story.tell(`alice, bob and charlie race with ${contenders.writes} writes against a ${contenders.lock} lock`);
			return engine.run(withIsolatedDatabase(race(contenders.writes === "guarded", contenders.lock, false)));
		},
		raceResults: () => Effect.sync(() => results),
		raceTally: () =>
			Effect.sync(() => ({
				claimed: results.filter((result) => result !== "full").length,
				full: results.filter((result) => result === "full").length,
			})),
		raceWhileAnotherSessionWaits: () => {
			story.tell("another session waits on the advisory lock, then alice, bob and charlie race with guarded writes behind it");
			return engine.run(withIsolatedDatabase(race(true, "advisory", true)));
		},
		secondTestSaw: () => Effect.sync(() => seen),
		secondTestWritesLockedRow: () => {
			story.tell("a second rollback test writes the row the first rollback test holds");
			return engine.run(secondTestWrites);
		},
		waitingAtRelease: () => Effect.sync(() => waiting),
	};
}
