import { Effect, Exit, Scope } from "effect";
import { Migrator, SqlClient } from "effect/sql";
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
		appliedMigrations: () => ledger,
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
		contactEmails: () =>
			Effect.flatMap(SqlClient.SqlClient, (sql) =>
				Effect.map(sql<{ email: string }>`select email from contacts order by id`, (rows) => rows.map(({ email }) => email)),
			),
		emailAddresses: () =>
			Effect.flatMap(
				SqlClient.SqlClient,
				(sql) => sql<{ address: string; contactId: number }>`select contact_id as "contactId", address from emails order by contact_id`,
			),
		loaderResolutions: () => Effect.sync(() => timesOf(engine.counts.loads)),
		loaderResource: () => Effect.sync(() => engine.loaderResource),
		migrateInRollbackTest: () => {
			story.tell("a rollback test migrates with steps acquired outside it");
			return attempt(withTestTransaction(engine.steps.migrateToLatest));
		},
		migrateTo: (target: string | number) =>
			Effect.gen(function* () {
				story.tell(`the steps migrate to ${JSON.stringify(target)}`);
				engine.migration = yield* attempt(engine.steps.migrateTo(target));
			}),
		migration: () => Effect.sync(() => engine.migration),
		tables: () => tableNames,
	};
}
