import { Deferred, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { onPostgres, onSqlite } from "./engines.ts";
import { purgeEngine, RetainedRow } from "./purgeEngine.ts";
import { purgeVerbs } from "./purgeVerbs.ts";

export const purges = storyKit({
	...onPostgres,
	create: purgeEngine,
	name: "PostgreSQL retention purges",
	stages: ["rows", "constraints", "locks"],
	verbs: (engine, story) => purgeVerbs(engine, story.tell),
});

export const pausingPurges = storyKit({
	...onPostgres,
	clock: "test",
	create: purgeEngine,
	name: "PostgreSQL throttled retention purges",
	stages: ["rows", "constraints", "locks"],
	verbs: (engine, story) => purgeVerbs(engine, story.tell),
});

export function storedRows(kit: typeof purges | typeof pausingPurges, count: number) {
	return kit.trait(
		"rows",
		`${count} rows already exist (bulk SQL fixture bypasses per-row change recording)`,
		({ sql, table }) => sql`insert into ${sql(table)} select generate_series(1, ${count}::int)`,
	);
}

export function rejectsBatch(ordinal: number) {
	return purges.trait(
		"constraints",
		`the batch audit rejects batch ${ordinal}`,
		({ sql, audit }) => sql`alter table ${sql(audit)} add check (ordinal <> ${sql.literal(String(ordinal))})`,
	);
}

export const sqlitePurges = storyKit({
	...onSqlite,
	create: () => makeRepository(RetainedRow, { idColumn: "id", spanPrefix: "Retention", tableName: "retention" }),
	name: "SQLite retention boundary",
	stages: [],
	verbs: (rows, story) => ({
		attemptPurge: () =>
			Effect.suspend(() => {
				story.tell("a SQLite repository receives a PostgreSQL retention purge");
				return rows.deleteBatched({ batchSize: 1, maxRows: 1, pause: 0, where: {} }).pipe(
					Effect.as("succeeded"),
					Effect.catchTag("BatchedDeleteUnavailable", (error) => Effect.succeed(`purge unavailable: ${error.reason}`)),
				);
			}),
	}),
});

export function rowLocked(id: number) {
	return purges.trait("locks", `another transaction holds row ${id}`, function* (engine) {
		const entered = yield* Deferred.make<void>();
		const { sql, table } = engine;
		engine.locker = yield* Effect.forkScoped(
			sql.withTransaction(
				sql`select id from ${sql(table)} where id = ${id} for update`.pipe(
					Effect.andThen(Deferred.succeed(entered, undefined)),
					Effect.andThen(Effect.never),
				),
			),
		);
		yield* Deferred.await(entered);
	});
}
