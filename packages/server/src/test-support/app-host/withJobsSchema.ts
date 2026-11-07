import { Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { getRollbackPlans, PgBoss } from "pg-boss";
import pgBossPackage from "pg-boss/package.json" with { type: "json" };
import { installPgBossSchema, pgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { migrationHost } from "#test/app-host/migrationStory.ts";

export function withJobsSchema(version: "missing" | "older" | "current" | "without deferrals") {
	return migrationHost.trait("schema", `a current ledger and ${version} pg-boss schema`, function* (state) {
		const schema = `${state.table}_jobs`;
		const sql = yield* SqlClient.SqlClient;
		yield* migratePostgres({ ...state.migrations, lockTimeout: "5 seconds" });
		state.migrations.components.push(pgBossSchema({ schema }));
		if (version === "missing") {
			return;
		}
		yield* installPgBossSchema({ schema });
		if (version === "without deferrals") {
			yield* sql`DROP TABLE ${sql(schema)}.effect_job_deferral`;
		}
		if (version === "older") {
			const boss = new PgBoss({ connectionString: Redacted.value(state.url), migrate: false, schedule: false, schema, supervise: false });
			yield* Effect.tryPromise(() => boss.start());
			yield* Effect.tryPromise(() => boss.getDb().executeSql(getRollbackPlans(schema, pgBossPackage.pgboss.schema))).pipe(
				Effect.ensuring(Effect.promise(() => boss.stop())),
			);
		}
	});
}

export const pendingJobsSchema = migrationHost.trait("schema", "pending ledger migrations and a missing pg-boss schema", (state) => {
	const schema = `${state.table}_jobs`;
	state.migrations.components.push(pgBossSchema({ schema }));
});
