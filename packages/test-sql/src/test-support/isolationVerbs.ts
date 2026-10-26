import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { invalidateOnCommit, transact } from "@shivaedev/sql/transact.ts";
import { PostgresTestDatabase } from "#database.ts";
import { withIsolatedDatabase } from "#withIsolatedDatabase.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { secondClient, values } from "./postgres.ts";

function writeItem(value: string) {
	return Effect.flatMap(SqlClient.SqlClient, (sql) => sql`update items set value = ${value}`);
}

export function isolationVerbs(engine: DatabaseEngine) {
	return {
		closeWorker: () => engine.close(),
		commitItem: (value: string) => transact(Effect.andThen(writeItem(value), invalidateOnCommit(["items"])), { onSqlError: (error) => error }),
		inClone: <A, E, R>(effect: Effect.Effect<A, E, R>) => engine.run(withIsolatedDatabase(effect)),
		openCloneClient: () => Effect.flatMap(PostgresTestDatabase, (database) => secondClient(database.url)),
		readCurrentDatabaseName: () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const [row] = yield* sql<{ name: string }>`select current_database() as name`;
				if (row === undefined) {
					return yield* Effect.die("PostgreSQL did not return the current database name.");
				}
				return row.name;
			}),
		readDatabases: (names: readonly string[]) =>
			engine.admin<{ datname: string }>`select datname from pg_database where ${engine.admin.in("datname", names)}`,
		readItems: () => values,
		readItemsFrom: (client: SqlClient.SqlClient) => client<{ value: string }>`select value from items order by id`,
		readPreparationCounts: () => Effect.sync(() => ({ ...engine.fixture.counts })),
		readSharedItems: () => engine.run(values),
		readWorkerDatabaseNames: () => Effect.map(engine.sharedName, (shared) => [engine.template, shared]),
		watchItemInvalidations: () =>
			Effect.gen(function* () {
				const reactivity = yield* Reactivity.Reactivity;
				const events: number[] = [];
				const unregister = reactivity.registerUnsafe(["items"], () => events.push(1));
				yield* Effect.addFinalizer(() => Effect.sync(unregister));
				return () => [...events];
			}),
		writeItem,
		writeSharedItem: (value: string) => engine.run(writeItem(value)),
	};
}
