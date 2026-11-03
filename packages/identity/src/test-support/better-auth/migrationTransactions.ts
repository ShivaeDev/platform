import { Effect, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { databaseUrl } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { migrateBetterAuth } from "#server/better-auth/adapters/migrate.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { compositionHost, compositionOptions, signUpAlice } from "./compositionHost.ts";

const postgres = makePostgresTestLayer({
	maxConnections: 1,
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
});

const applicationTables = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table registration_notes (kind text primary key)`;
	yield* sql`create table migrated_registrations (email text primary key, role text not null)`;
});

const registerInMigration = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const storage = yield* authTestDatabase;
	yield* storage.migrate(compositionOptions, { defaultRole: "member" });
	const host = yield* compositionHost({ refuseAccount: false });
	const response = yield* signUpAlice(host);
	if (!response.ok) {
		return yield* Effect.die(`Migration sign-up failed with HTTP ${response.status}: ${yield* Effect.promise(() => response.text())}`);
	}
	const users = yield* storage.userRoles;
	yield* sql`insert into migrated_registrations ${sql.insert(users)}`;
}).pipe(Effect.scoped);

export const authMigrationTransactions = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const sql = yield* SqlClient.SqlClient;
		yield* migratePostgres({
			loader: Migrator.fromRecord({
				"0001_auth": migrateBetterAuth(compositionOptions).pipe(Effect.scoped),
				"0002_application": applicationTables,
			}),
			lockTimeout: "2 seconds",
		});
		return { sql, storage: yield* authTestDatabase };
	},
	layer: postgres,
	name: "auth inside numbered migrations",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: (engine, story) => ({
		migrate: () => {
			story.tell("the numbered migration adds an auth column, registers alice through its local adapter, then copies her stored role");
			return migratePostgres({
				loader: Migrator.fromRecord({
					"0001_auth": migrateBetterAuth(compositionOptions).pipe(Effect.scoped),
					"0002_application": applicationTables,
					"0003_register": registerInMigration,
				}),
				lockTimeout: "2 seconds",
			}).pipe(Effect.timeout("10 seconds"));
		},
		storedMigrationRegistrations: () => engine.sql<{ email: string; role: string }>`select email, role from migrated_registrations order by email`,
		storedUsers: () => Effect.map(engine.storage.users, (rows) => rows.map(({ email }) => email)),
	}),
});
