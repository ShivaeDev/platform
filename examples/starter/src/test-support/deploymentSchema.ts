import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { authDatabase } from "@shivaedev/platform/server/better-auth/mount.ts";
import { authTestDatabase } from "@shivaedev/platform/server/better-auth/testDatabase.ts";

export function deploymentSchema(tell: (line: string) => void) {
	return {
		dropAuthColumn: Effect.gen(function* () {
			tell("an incomplete schema is missing the auth image column");
			const database = yield* PostgresTestDatabase;
			const pool = yield* authDatabase(database.url);
			yield* authTestDatabase(pool).omitImageColumn;
		}),
		migrationLedger: Effect.fn("DeploymentStory.migrationLedger")(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql`select migration_id, name, created_at from app_migrations order by migration_id`;
		}),
		migrationTable: Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			return yield* sql`select to_regclass('app_migrations') as ledger`;
		}),
		storedAccounts: Effect.gen(function* () {
			const database = yield* PostgresTestDatabase;
			const pool = yield* authDatabase(database.url);
			return (yield* authTestDatabase(pool).users).map(({ email }) => ({ email }));
		}),
		storeUnownedNote: Effect.fn("DeploymentStory.storeUnownedNote")(function* (title: string) {
			tell(`save the unowned note ${JSON.stringify(title)}`);
			const sql = yield* SqlClient.SqlClient;
			yield* sql`insert into notes (title) values (${title})`;
		}),
	};
}
