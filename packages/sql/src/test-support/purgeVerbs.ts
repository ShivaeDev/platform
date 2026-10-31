import { Effect, Fiber, Queue } from "effect";
import * as TestClock from "effect/testing/TestClock";
import type { BatchedDeleteOptions } from "#batchedDelete.ts";
import { ChangeObserver, transact } from "#transact.ts";
import { failureOf } from "./outcome.ts";
import type { PurgeEngine, RetainedRow } from "./purgeEngine.ts";

export function purgeVerbs(engine: PurgeEngine, tell: (line: string) => void) {
	const { rows, sql, table, audit } = engine;
	function purge(options: BatchedDeleteOptions<typeof RetainedRow>) {
		return rows.deleteBatched(options).pipe(
			Effect.provideService(ChangeObserver, (event) =>
				Effect.gen(function* () {
					if (event._tag === "Published") {
						engine.hints.push([...event.changes]);
						yield* Queue.offer(engine.publications, undefined);
					}
				}),
			),
		);
	}
	function active() {
		return engine.fiber === undefined ? Effect.die(new Error("Start a purge first")) : Effect.succeed(engine.fiber);
	}
	return {
		batchTransactions: () =>
			Effect.map(
				sql<{ readonly count: number }>`select count(distinct transaction_id)::int as count from ${sql(audit)} where removed > 0`,
				([row]) => row?.count,
			),
		competingPurge: (options: BatchedDeleteOptions<typeof RetainedRow>) =>
			Effect.suspend(() => {
				tell("another repository instance attempts a purge of the same table");
				return engine.competingRows.deleteBatched(options);
			}),
		deletedPerBatch: () =>
			Effect.map(sql<{ readonly removed: number }>`select removed from ${sql(audit)} where removed > 0 order by ordinal`, (records) =>
				records.map((row) => row.removed),
			),
		finishPurge: () => Effect.flatMap(active(), Fiber.join),
		hints: () => Effect.sync(() => engine.hints.map((keys) => keys.map((key) => (key === table ? "the table" : String(key))))),
		interruptPurge: () =>
			Effect.gen(function* () {
				tell("the running purge is interrupted between batches");
				yield* Fiber.interrupt(yield* active());
			}),
		passTime: (milliseconds: number) =>
			Effect.suspend(() => {
				tell(`${milliseconds} milliseconds pass`);
				return TestClock.adjust(milliseconds);
			}),
		purge: (options: BatchedDeleteOptions<typeof RetainedRow>) =>
			Effect.suspend(() => {
				tell(`retention deletes at most ${options.maxRows} rows in batches of ${options.batchSize}`);
				return purge(options);
			}),
		purgeFailure: (options: BatchedDeleteOptions<typeof RetainedRow>, inTransaction: false | "native" | "transact" = false) =>
			Effect.gen(function* () {
				tell(`retention attempts a purge${inTransaction ? " inside a transaction" : ""}`);
				const owned = inTransaction === "transact" ? transact(purge(options), { onSqlError: (error) => error }) : purge(options);
				const run = inTransaction === "native" ? sql.withTransaction(owned) : owned;
				return yield* run.pipe(
					Effect.as("succeeded"),
					Effect.catchTag("BatchedDeleteUnavailable", (error) => Effect.succeed(`purge unavailable: ${error.reason}`)),
					Effect.catchTag("SchemaError", () => Effect.succeed("a schema error")),
					Effect.catchTag("SqlError", (error) => Effect.succeed(failureOf(error))),
				);
			}),
		refreshes: () => Effect.sync(() => engine.refreshed.length),
		releaseRowLock: () =>
			Effect.suspend(() => {
				tell("the other transaction releases its row lock");
				return engine.locker === undefined ? Effect.die(new Error("Lock a row first")) : Fiber.interrupt(engine.locker);
			}),
		remaining: () => rows.count(),
		retainedIds: () => rows.findMany({ orderBy: { direction: "asc", field: "id" } }).pipe(Effect.map((records) => records.map(({ id }) => id))),
		startPurge: (options: BatchedDeleteOptions<typeof RetainedRow>) =>
			Effect.gen(function* () {
				tell("retention starts a purge and its first committed batch announces its table");
				engine.fiber = yield* Effect.forkScoped(purge(options));
				yield* Queue.take(engine.publications);
			}),
		waitForBatch: () => Queue.take(engine.publications),
	};
}
