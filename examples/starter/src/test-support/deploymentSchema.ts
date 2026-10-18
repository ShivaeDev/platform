import { Effect } from "effect";
import { SqlClient } from "effect/sql";

export function deploymentSchema(tell: (line: string) => void) {
	return {
		dropAuthColumn: Effect.gen(function* () {
			tell("an incomplete schema is missing the auth image column");
			const sql = yield* SqlClient.SqlClient;
			yield* sql`alter table "user" drop column image`;
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
			const sql = yield* SqlClient.SqlClient;
			return yield* sql`select email from "user"`;
		}),
		storeUnownedNote: Effect.fn("DeploymentStory.storeUnownedNote")(function* (title: string) {
			tell(`save the unowned note ${JSON.stringify(title)}`);
			const sql = yield* SqlClient.SqlClient;
			yield* sql`insert into notes (title) values (${title})`;
		}),
	};
}
