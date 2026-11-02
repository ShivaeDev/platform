import { Effect, Option, Result } from "effect";
import { SqlClient } from "effect/sql";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { raceWithLock } from "#raceWithLock.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { failureOf } from "./outcome.ts";
import { anotherSessionWaits, claim, type Lock, takeLock } from "./raceClaims.ts";

function waitingOn(query: string) {
	return query.includes("pg_advisory_xact_lock") ? "the advisory lock" : "the items update";
}

export function raceVerbs(engine: DatabaseEngine, story: Story<DatabaseEngine>) {
	let waiting: readonly string[] = [];
	let claims: readonly string[] = [];
	let failures: readonly string[] = [];
	let seen: readonly string[] = [];
	let read = "";
	let stalled = "";
	const race = Effect.fnUntraced(function* (guarded: boolean, lock: Lock, outsider: boolean, failingRacer?: string) {
		const sql = yield* SqlClient.SqlClient;
		const recordWaiting = Effect.gen(function* () {
			yield* sql`select pg_stat_clear_snapshot()`;
			const rows = yield* sql<{ query: string }>`select query from pg_stat_activity
				where datname = current_database() and wait_event_type = 'Lock'`;
			waiting = rows.map(({ query }) => waitingOn(query));
		});
		const raced = yield* raceWithLock({
			effects: ["alice", "bob", "charlie"].map((name) =>
				sql.withTransaction(
					claim(sql, name, guarded, lock, outsider ? 1 : 0).pipe(
						Effect.tap(() => (name === failingRacer ? Effect.asVoid(sql`select 1 / 0`) : Effect.void)),
					),
				),
			),
			lock: Effect.gen(function* () {
				yield* takeLock(sql, lock);
				if (outsider) {
					yield* anotherSessionWaits(sql);
				}
				yield* Effect.addFinalizer(() => recordWaiting.pipe(Effect.orDie));
			}),
		});
		claims = raced.filter(Result.isSuccess).map((result) => result.success);
		failures = raced.filter(Result.isFailure).map((result) => failureOf(result.failure));
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
	const bobNeverQueues = Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* raceWithLock({
			effects: [sql`update items set value = 'alice' where id = 1`, sql`select 1`],
			lock: takeLock(sql, "table"),
			timeout: "500 millis",
		}).pipe(
			Effect.catchTag("NeverSettled", (error) =>
				Effect.sync(() => {
					stalled = `waited for ${error.waitingFor}; ${Option.getOrElse(error.last, () => 0)} blocked at the last read`;
				}),
			),
		);
	});
	return {
		contenderReadsHeldRow: (release?: "commit") => {
			story.tell(`a contender waits to read the row a holder updated, and the holder releases with ${release ?? "its default rollback"}`);
			return engine.run(withIsolatedDatabase(contenderReads(release)));
		},
		contenderSaw: () => {
			story.tell("the story reads the value seen by the contender");
			return Effect.sync(() => read);
		},
		race: (contenders: { readonly lock: Lock; readonly writes: "guarded" | "unguarded" }) => {
			story.tell(`alice, bob and charlie race with ${contenders.writes} writes against a ${contenders.lock} lock`);
			return engine.run(withIsolatedDatabase(race(contenders.writes === "guarded", contenders.lock, false)));
		},
		raceResults: () => {
			story.tell("the story reads the race’s claims and failures separately");
			return Effect.sync(() => ({ claims, failures }));
		},
		raceTally: () => {
			story.tell("the story counts the race’s claims, full places and other failures");
			return Effect.sync(() => ({
				claimed: claims.length,
				failed: failures.filter((failure) => failure !== "full").length,
				full: failures.filter((failure) => failure === "full").length,
			}));
		},
		raceWhereBobFails: () => {
			story.tell("alice, bob and charlie race with unguarded writes behind a table lock, and bob divides by zero before committing");
			return engine.run(withIsolatedDatabase(race(false, "table", false, "bob")));
		},
		raceWhereBobNeverQueues: () => {
			story.tell("alice updates the item behind a table lock while bob only selects 1, so bob never queues on the lock");
			return engine.run(withIsolatedDatabase(bobNeverQueues));
		},
		raceWhileAnotherSessionWaits: () => {
			story.tell("another session waits on the advisory lock, then alice, bob and charlie race with guarded writes behind it");
			return engine.run(withIsolatedDatabase(race(true, "advisory", true)));
		},
		secondTestSaw: () => {
			story.tell("the story reads the items seen by the second rollback test");
			return Effect.sync(() => seen);
		},
		secondTestWritesLockedRow: () => {
			story.tell("a second rollback test writes the row the first rollback test holds");
			return engine.run(secondTestWrites);
		},
		stalledRace: () => {
			story.tell("the story reads why the race did not settle");
			return Effect.sync(() => stalled);
		},
		waitingAtRelease: () => {
			story.tell("the story reads which locks the contenders waited on at release");
			return Effect.sync(() => waiting);
		},
	};
}
