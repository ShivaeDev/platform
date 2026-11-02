import { Effect, Exit, Scope } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { readPostgresRelease } from "@shivaedev/sql/postgresRelease.ts";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { migrationSteps } from "#migrationSteps.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import { tableNames } from "./cloneStory.ts";
import { migrations } from "./migrationSteps.ts";
import { attempt, timesOf } from "./outcome.ts";

export interface StepsEngine {
	readonly counts: { loads: number };
	loaderResource: "not acquired" | "open" | "closed";
	migration: string;
	steps: Effect.Success<ReturnType<typeof migrationSteps<never>>>;
	stepsScope: Scope.Closeable | undefined;
}

export const createSteps = Effect.gen(function* () {
	const counts = { loads: 0 };
	const steps = yield* migrationSteps({
		...migrations,
		loader: Effect.map(migrations.loader, (resolved) => {
			counts.loads += 1;
			return resolved;
		}),
	});
	const engine: StepsEngine = { counts, loaderResource: "not acquired", migration: "not attempted", steps, stepsScope: undefined };
	return engine;
});

export const ledger = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	if (!(yield* tableNames).includes(migrations.table)) {
		return [];
	}
	const rows = yield* sql<{ id: number }>`select migration_id as id from ${sql(migrations.table)} order by migration_id`;
	return rows.map(({ id }) => id);
});

export function stepsVerbs(engine: StepsEngine, story: Story<StepsEngine>) {
	return {
		acquireStepsInRollbackTest: () => {
			story.tell("a rollback test acquires migration steps");
			return attempt(withTestTransaction(migrationSteps(migrations)));
		},
		acquireStepsWithFailingLoader: () => {
			story.tell("the caller acquires migration steps from a loader that fails with ImportError");
			const failure = new Migrator.MigrationError({ kind: "ImportError", message: "loader refused" });
			return attempt(Effect.scoped(migrationSteps({ ...migrations, loader: Effect.fail(failure) })));
		},
		appliedMigrations: () => {
			story.tell("the story reads the migration ledger");
			return ledger;
		},
		backfill: () => {
			story.tell("the steps migrate to the latest migration");
			return engine.steps.migrateToLatest;
		},
		closeStepsScope: () =>
			Effect.suspend(() => {
				story.tell("the caller closes the scope that acquired the steps");
				return engine.stepsScope === undefined
					? Effect.die(new Error("Declare scopedLoader before closing its scope."))
					: Scope.close(engine.stepsScope, Exit.void);
			}),
		contactEmails: () => {
			story.tell("the story reads the contacts’ email column");
			return Effect.flatMap(SqlClient.SqlClient, (sql) =>
				Effect.map(sql<{ email: string }>`select email from contacts order by id`, (rows) => rows.map(({ email }) => email)),
			);
		},
		directoryAddresses: () => {
			story.tell("the story reads the contact directory addresses");
			return Effect.flatMap(
				SqlClient.SqlClient,
				(sql) => sql<{ address: string; contactId: number }>`select contact_id as "contactId", address from contact_directory order by contact_id`,
			);
		},
		emailAddresses: () => {
			story.tell("the story reads the email addresses");
			return Effect.flatMap(
				SqlClient.SqlClient,
				(sql) => sql<{ address: string; contactId: number }>`select contact_id as "contactId", address from emails order by contact_id`,
			);
		},
		loaderResolutions: () => {
			story.tell("the story reads how often the migration loader resolved");
			return Effect.sync(() => timesOf(engine.counts.loads));
		},
		loaderResource: () => {
			story.tell("the story reads whether the migration loader resource is open");
			return Effect.sync(() => engine.loaderResource);
		},
		migrateInRollbackTest: () => {
			story.tell("a rollback test migrates with steps acquired outside it");
			return attempt(withTestTransaction(engine.steps.migrateToLatest));
		},
		migrateTo: (target: string | number) =>
			Effect.gen(function* () {
				story.tell(`the steps migrate to ${JSON.stringify(target)}`);
				engine.migration = yield* attempt(engine.steps.migrateTo(target));
			}),
		migration: () => {
			story.tell("the story reads the migration outcome");
			return Effect.sync(() => engine.migration);
		},
		recordedRelease: () => {
			story.tell("the story reads the recorded PostgreSQL release");
			return Effect.map(readPostgresRelease(migrations.table), (release) => release?.release ?? "none");
		},
		tables: () => {
			story.tell("the story reads the database’s tables");
			return tableNames;
		},
	};
}
