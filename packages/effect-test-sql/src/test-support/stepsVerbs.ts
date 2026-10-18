import { Effect } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { expect } from "vitest";
import { PostgresTestDatabase } from "#database.ts";
import { migrationSteps } from "#migrationSteps.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import { emails, expectedEmails, migrations, seedContacts } from "./migrationSteps.ts";
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
		backfill: () => engine.steps.migrateToLatest,
		backfillCommitsEachStep: () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const database = yield* PostgresTestDatabase;
				const observer = yield* secondClient(database.url);
				expect(yield* sql`select to_regclass('contacts') as name`).toEqual([{ name: null }]);
				yield* engine.steps.migrateTo("1_create_contacts");
				yield* seedContacts;
				expect(yield* observer`select email from contacts order by id`).toEqual([{ email: "alice@example.test" }, { email: "bob@example.test" }]);
				yield* engine.steps.migrateToLatest;
				expect(yield* emails).toEqual(expectedEmails);
				expect(yield* observer`select contact_id, address from emails order by contact_id`).toEqual(expectedEmails);
				expect(yield* sql`select email from contacts`.pipe(Effect.flip)).toMatchObject({ _tag: "SqlError" });
				expect(yield* sql`select migration_id from ${sql(migrations.table)} order by migration_id`).toEqual([
					{ "migration_id": 1 },
					{ "migration_id": 2 },
					{ "migration_id": 3 },
				]);
				expect(engine.counts.loads).toBe(1);
			}),
		emailsArePreserved: () =>
			Effect.gen(function* () {
				expect(yield* emails).toEqual(expectedEmails);
			}),
		stepsResumeAndRejectGoingBackwards: () =>
			Effect.gen(function* () {
				yield* engine.steps.migrateTo("1_create_contacts");
				yield* engine.steps.migrateTo("2_backfill_emails");
				const sql = yield* SqlClient.SqlClient;
				expect(yield* sql`select email from contacts`).toEqual([]);
				expect(yield* engine.steps.migrateTo("1_create_contacts").pipe(Effect.flip)).toMatchObject({
					_tag: "MigrationError",
					kind: "BadState",
					message: "Cannot migrate to 1: later migrations are already applied.",
				});
				const resumed = yield* migrationSteps(migrations);
				yield* resumed.migrateToLatest;
				yield* resumed.migrateToLatest;
				expect(yield* sql`select migration_id from ${sql(migrations.table)}`).toHaveLength(3);
			}),
		targetIsRejected: (reason: "not in" | "ambiguous in") =>
			Effect.gen(function* () {
				const error = yield* engine.steps.migrateTo(engine.target).pipe(Effect.flip);
				expect(error).toBeInstanceOf(Migrator.MigrationError);
				expect(error).toMatchObject({ kind: "BadState", message: `Migration "${engine.target}" is ${reason} the loader.` });
				const sql = yield* SqlClient.SqlClient;
				const table = reason === "not in" ? "contacts" : sql`${sql(migrations.table)}`.compile()[0];
				expect(yield* sql`select to_regclass(${table}) as name`).toEqual([{ name: null }]);
			}),
		targetStopsAtBackfill: () =>
			Effect.gen(function* () {
				yield* engine.steps.migrateTo(engine.target);
				const sql = yield* SqlClient.SqlClient;
				expect(yield* sql`select migration_id from ${sql(migrations.table)} order by migration_id`).toEqual([
					{ "migration_id": 1 },
					{ "migration_id": 2 },
				]);
				expect(yield* sql`select email from contacts`).toEqual([]);
				expect(yield* sql`select address from emails`).toEqual([]);
			}),
		wrappingTransactionsAreRejected: () =>
			Effect.gen(function* () {
				for (const effect of [
					withTestTransaction(migrationSteps(migrations)).pipe(Effect.asVoid),
					withTestTransaction(engine.steps.migrateToLatest).pipe(Effect.asVoid),
				]) {
					expect(yield* effect.pipe(Effect.flip)).toMatchObject({
						_tag: "MigrationError",
						kind: "BadState",
						message: "Migration steps must run outside a wrapping transaction.",
					});
				}
			}),
	};
}
