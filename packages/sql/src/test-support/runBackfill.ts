import { Deferred, Effect } from "effect";
import { backfillPostgres } from "#backfillPostgres.ts";
import { CommittedSink, invalidateOnCommit } from "#transact.ts";
import { type BackfillEngine, type BackfillRow, ProgressRejected, storedBackfillProgress, storedBackfillRows } from "./backfillEngine.ts";

export function runBackfill(engine: BackfillEngine, run: string, batchSize = 2) {
	const { sql, tables } = engine;
	return backfillPostgres({
		batchSize,
		loadProgress: Effect.map(
			sql<{ readonly id: number }>`select last_id as id from ${sql(tables.progress)} where run = ${run}`,
			([row]) => row?.id ?? 0,
		),
		lock: `${tables.items}:${run}`,
		process: (row: BackfillRow) =>
			Effect.gen(function* () {
				if (row.name === row.name.toUpperCase()) {
					return;
				}
				yield* sql`update ${sql(tables.items)} set name = upper(name), writes = writes + 1 where run = ${run} and id = ${row.id}`;
				yield* invalidateOnCommit([`item:${row.id}`]);
			}),
		saveProgress: (last) =>
			Effect.gen(function* () {
				yield* sql`insert into ${sql(tables.progress)} (run, last_id) values (${run}, ${last.id}) on conflict (run) do update set last_id = excluded.last_id`;
				if (run === "resumed" && engine.failAt === last.id) {
					return yield* new ProgressRejected();
				}
				if (run === "resumed" && engine.holdAt === last.id) {
					engine.holdAt = undefined;
					yield* Deferred.succeed(engine.paused, undefined);
					yield* Effect.never;
				}
			}),
		select: (after, limit) =>
			sql<BackfillRow>`select id, name, writes from ${sql(tables.items)} where run = ${run} and id > ${after} order by id limit ${limit + engine.selectExtra} for update`,
	}).pipe(
		Effect.provideService(CommittedSink, (keys) =>
			Effect.gen(function* () {
				const rows = yield* storedBackfillRows(engine, run);
				const progress = yield* storedBackfillProgress(engine, run);
				engine.announcements[run] ??= [];
				engine.announcements[run].push({ keys, progress, rows });
			}).pipe(Effect.orDie),
		),
	);
}
