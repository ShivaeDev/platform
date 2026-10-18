import { Effect, Exit, Redacted, type Scope } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";

const applicationFinalizersKeepDatabaseOpen = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	let owner: Scope.Scope | undefined;
	const isolated = Effect.gen(function* () {
		owner = yield* Effect.scope;
		return yield* database.isolated;
	});
	yield* withIsolatedDatabase(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* Effect.addFinalizer(() =>
				Effect.gen(function* () {
					expect(owner?.state._tag).toBe("Open");
					expect(yield* sql`select 1 as available`.pipe(Effect.orDie)).toEqual([{ available: 1 }]);
				}),
			);
		}),
	).pipe(Effect.provideService(PostgresTestDatabase, { ...database, isolated }));
});

const failedDatabaseDropIsDefect = Effect.fn("DatabaseStory.failedDatabaseDropIsDefect")(function* (engine: DatabaseEngine) {
	const admin = engine.admin;
	const role = new URL(Redacted.value(engine.options.url)).username;
	let name = "";
	const cleanup = Effect.gen(function* () {
		yield* admin`alter role ${admin(role)} connection limit 2`;
		if (name !== "") {
			yield* admin`drop database if exists ${admin(name)} with (force)`;
		}
	});
	yield* engine.run(
		Effect.scoped(
			Effect.gen(function* () {
				yield* Effect.addFinalizer(() => Effect.orDie(cleanup));
				const exit = yield* withIsolatedDatabase(
					Effect.gen(function* () {
						const database = yield* PostgresTestDatabase;
						name = new URL(Redacted.value(database.url)).pathname.slice(1);
						yield* admin`alter role ${admin(role)} connection limit 0`;
					}),
				).pipe(Effect.exit);
				expect(Exit.isFailure(exit) && exit.cause.reasons).toMatchObject([
					{ _tag: "Die", defect: { _tag: "SqlError", reason: { cause: { code: "53300" } } } },
				]);
				expect(yield* admin`select datname from pg_database where datname = ${name}`).toEqual([{ datname: name }]);
			}),
		),
	);
	expect(yield* admin`select datname from pg_database where datname = ${name}`).toEqual([]);
});

export function lifecycleVerbs(engine: DatabaseEngine) {
	return {
		applicationFinalizersKeepDatabaseOpen: () => engine.run(applicationFinalizersKeepDatabaseOpen),
		failedDatabaseDropIsDefect: () => failedDatabaseDropIsDefect(engine),
	};
}
