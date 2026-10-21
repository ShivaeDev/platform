import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "#database.ts";
import { migrationSteps } from "#migrationSteps.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import { emails, migrations, seedContacts } from "./migrationSteps.ts";
import { secondClient } from "./postgres.ts";

export const createSteps = Effect.gen(function* () {
	const counts = { loads: 0 };
	const steps = yield* migrationSteps({
		...migrations,
		loader: Effect.map(migrations.loader, (resolved) => {
			counts.loads += 1;
			return resolved;
		}),
	});
	const engine: { counts: typeof counts; steps: typeof steps; target: string | number } = { counts, steps, target: "missing_backfill" };
	return engine;
});

type Engine = Effect.Success<typeof createSteps>;

export function stepsVerbs(engine: Engine) {
	return {
		acquireInTransaction: () => withTestTransaction(migrationSteps(migrations)),
		backfill: () => engine.steps.migrateToLatest,
		migrateInTransaction: () => withTestTransaction(engine.steps.migrateToLatest),
		migrateTo: (target: string | number = engine.target) => engine.steps.migrateTo(target),
		openObserver: () => Effect.flatMap(PostgresTestDatabase, (database) => secondClient(database.url)),
		readAddresses: () => Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select address from emails`),
		readContacts: () => Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select email from contacts order by id`),
		readEmails: () => emails,
		readLedger: () => Effect.flatMap(SqlClient.SqlClient, (sql) => sql`select migration_id from ${sql(migrations.table)} order by migration_id`),
		readLoads: () => Effect.sync(() => engine.counts.loads),
		readTable: (table: "contacts" | "ledger") =>
			Effect.flatMap(SqlClient.SqlClient, (sql) => {
				const name = table === "contacts" ? "contacts" : sql`${sql(migrations.table)}`.compile()[0];
				return sql`select to_regclass(${name}) as name`;
			}),
		resume: () =>
			Effect.gen(function* () {
				engine.steps = yield* migrationSteps(migrations);
			}),
		seedContacts: () => seedContacts,
	};
}
