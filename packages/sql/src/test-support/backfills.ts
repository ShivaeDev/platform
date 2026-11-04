import { Deferred, Effect, Fiber } from "effect";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { backfillEngine, storedBackfillProgress, storedBackfillRows } from "./backfillEngine.ts";
import { onPostgres } from "./engines.ts";
import { attempt, outcomeOf } from "./outcome.ts";
import { runBackfill } from "./runBackfill.ts";

export const backfills = storyKit({
	...onPostgres,
	create: backfillEngine,
	inspect: (engine) => ({ announcements: engine.announcements, failAt: engine.failAt, holdAt: engine.holdAt }),
	name: "PostgreSQL backfills",
	stages: ["rows", "selection", "progress"],
	verbs: (engine, story) => ({
		announcements: (run = "resumed") => Effect.sync(() => [...(engine.announcements[run] ?? [])]),
		finishCompeting: () =>
			Effect.gen(function* () {
				story.tell("the competing backfill finishes");
				if (engine.competing === undefined) {
					return yield* Effect.die(new Error("Start a competing backfill first"));
				}
				return yield* Fiber.join(engine.competing);
			}),
		interrupt: () =>
			Effect.gen(function* () {
				story.tell("the caller interrupts the held backfill");
				if (engine.running === undefined) {
					return yield* Effect.die(new Error("Start a held backfill first"));
				}
				yield* Fiber.interrupt(engine.running);
				return outcomeOf(yield* Fiber.await(engine.running));
			}),
		ledger: () => engine.observer`select migration_id as id, name from ${engine.observer(engine.tables.ledger)} order by migration_id`,
		run: (run = "resumed", batchSize = 2) =>
			Effect.suspend(() => {
				story.tell(`${run} backfills at most ${batchSize} rows per batch`);
				return attempt(runBackfill(engine, run, batchSize));
			}),
		runInTransaction: () =>
			Effect.suspend(() => {
				story.tell("the caller runs the backfill inside a native transaction");
				return attempt(engine.sql.withTransaction(runBackfill(engine, "resumed")));
			}),
		startCompeting: () =>
			Effect.gen(function* () {
				story.tell("a second backfill starts and waits on the first batch's advisory lock");
				const { observer: sql, tables } = engine;
				const fiber = yield* Effect.forkScoped(attempt(runBackfill(engine, "resumed")));
				engine.competing = fiber;
				const waiting = sql<{ readonly waiting: boolean }>`select exists (select 1 from pg_locks
					where locktype = 'advisory' and not granted and objsubid = 1
					and database = (select oid from pg_database where datname = current_database())
					and ((classid::bigint << 32) | objid::bigint) = hashtextextended(${`${tables.items}:resumed`}, 0)) as waiting`;
				return yield* Effect.raceFirst(
					observeUntil(waiting, ([row]) => row?.waiting === true, "the competing backfill to wait on the batch lock", { clock: "test" }),
					Effect.andThen(Fiber.await(fiber), Effect.die(new Error("The competing backfill finished without waiting"))),
				);
			}),
		startHeld: () =>
			Effect.gen(function* () {
				story.tell("the backfill starts and holds a batch after writing its progress");
				const fiber = yield* Effect.forkScoped(attempt(runBackfill(engine, "resumed")));
				engine.running = fiber;
				yield* Effect.raceFirst(
					Deferred.await(engine.paused),
					Effect.andThen(Fiber.await(fiber), Effect.die(new Error("The backfill finished before reaching the held batch"))),
				);
			}),
		storedProgress: (run = "resumed") => storedBackfillProgress(engine, run),
		storedRows: (run = "resumed") => storedBackfillRows(engine, run),
	}),
});

export function rowsStored(count: number, style: "draft" | "capitalized" = "draft") {
	return backfills.trait(
		"rows",
		`both backfills have ${count} stored ${style} rows`,
		({ sql, tables }) =>
			sql`insert into ${sql(tables.items)} (run, id, name) select run, id, ${style === "draft" ? "draft " : "DRAFT "} || id
			from unnest(array['resumed', 'reference']) run cross join generate_series(1, ${count}::integer) id`,
	);
}

export function progressHeldAt(id: number) {
	return backfills.trait("progress", `saving progress at row ${id} holds the transaction open`, (engine) =>
		Effect.sync(() => {
			engine.holdAt = id;
		}),
	);
}

export function selectionIncludesLookahead() {
	return backfills.trait("selection", "selection includes one lookahead row beyond the requested limit", (engine) =>
		Effect.sync(() => {
			engine.selectExtra = 1;
		}),
	);
}

export function progressFailsAt(id: number) {
	return backfills.trait("progress", `saving progress at row ${id} fails after its SQL write`, (engine) =>
		Effect.sync(() => {
			engine.failAt = id;
		}),
	);
}
