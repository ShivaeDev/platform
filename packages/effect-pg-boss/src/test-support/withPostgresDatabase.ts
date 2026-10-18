import { Effect, Redacted } from "effect";
import { Migrator } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";

export function withPostgresDatabase<A>(url: string, run: (connectionString: string) => Promise<A>): Promise<A> {
	const layer = makePostgresTestLayer({
		migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
		prepare: false,
		url: Redacted.make(url),
	});
	return Effect.runPromise(
		withIsolatedDatabase(Effect.flatMap(PostgresTestDatabase, (database) => Effect.promise(() => run(Redacted.value(database.url))))).pipe(
			Effect.provide(layer),
		),
	);
}
