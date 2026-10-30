import * as PgClient from "@effect/sql-pg/PgClient";
import { Deferred, Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import { currentDatabase, type DatabaseEngine } from "./databaseEngine.ts";
import { attempt } from "./outcome.ts";

type Wrapper = "a rollback test" | "an isolated block";

const divideByZero = Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select 1 / 0`);

export function limitVerbs(engine: DatabaseEngine, story: Story<DatabaseEngine>) {
	const clones: string[] = [];
	const demand = Effect.fnUntraced(function* (count: number, each: number) {
		const poolSize = engine.options.maxConnections ?? 2;
		const entered = yield* Deferred.make<void>();
		const release = yield* Deferred.make<void>();
		yield* Effect.addFinalizer(() => Deferred.succeed(release, undefined));
		let holding = 0;
		const hold = Effect.gen(function* () {
			holding += 1;
			if (holding === count * poolSize) {
				yield* Deferred.succeed(entered, undefined);
			}
			yield* Deferred.await(release);
		});
		const clone = withIsolatedDatabase(
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				clones.push(yield* currentDatabase);
				yield* Effect.forEach(Array.from({ length: each }), () => Effect.scoped(Effect.andThen(sql.reserve, hold)), { concurrency: "unbounded" });
			}),
		);
		yield* engine.run(Effect.forEach(Array.from({ length: count }), () => clone, { concurrency: "unbounded" })).pipe(Effect.forkScoped);
		yield* Deferred.await(entered);
	});
	return {
		clonesDemandConnections: ({ clones: count, each }: { readonly clones: number; readonly each: number }) => {
			story.tell(`${count} clones each ask for ${each} connections at once and hold the ones they get`);
			return demand(count, each);
		},
		connectionsPerClone: () =>
			Effect.map(
				engine.admin<{ total: number }>`select count(*)::int as total from pg_stat_activity
					where ${engine.admin.in("datname", clones)} group by datname`,
				(rows) => rows.map(({ total }) => total),
			),
		divideByZeroIn: (wrapper: Wrapper) => {
			story.tell(`a query in ${wrapper} divides by zero`);
			return wrapper === "a rollback test"
				? attempt(engine.run(withTestTransaction(divideByZero)))
				: attempt(engine.run(withIsolatedDatabase(divideByZero)));
		},
		isolatedBlockWithoutConnections: () => {
			story.tell("an isolated block holds its clone's only connection and opens another client");
			return attempt(
				engine.run(
					withIsolatedDatabase(
						Effect.gen(function* () {
							const sql = yield* SqlClient.SqlClient;
							yield* sql.reserve;
							const database = yield* PostgresTestDatabase;
							yield* PgClient.makeClient({ url: database.url });
						}),
					),
				),
			);
		},
		rollbackTestWithoutConnections: () => {
			story.tell("the shared pool holds the role's only connection and a rollback test starts");
			return attempt(
				engine.run(
					Effect.scoped(
						Effect.gen(function* () {
							const sql = yield* SqlClient.SqlClient;
							yield* sql.reserve;
							yield* withTestTransaction(Effect.void);
						}),
					),
				),
			);
		},
	};
}
