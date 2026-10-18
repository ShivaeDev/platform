import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";

export function deploymentSchema(tell: (line: string) => void) {
	const ledger = Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		return yield* sql`select migration_id, name, created_at from app_migrations order by migration_id`;
	});
	return {
		migrationLedger: () => ledger,
		migrationLedgerIs: Effect.fn("DeploymentStory.migrationLedgerIs")(function* (expected: readonly unknown[]) {
			tell("check that rerunning migration preserves the applied ledger");
			expect(yield* ledger).toEqual(expected);
		}),
		migrationLedgerIsAbsent: Effect.gen(function* () {
			tell("check that no migration was recorded");
			const sql = yield* SqlClient.SqlClient;
			expect(yield* sql`select to_regclass('app_migrations') as ledger`).toEqual([{ ledger: null }]);
		}),
		noAccountsAreStored: Effect.gen(function* () {
			tell("check that migration created no accounts");
			const sql = yield* SqlClient.SqlClient;
			expect(yield* sql`select count(*)::int as count from "user"`).toEqual([{ count: 0 }]);
		}),
		storeUnownedNote: Effect.fn("DeploymentStory.storeUnownedNote")(function* (title: string) {
			tell(`save the unowned note ${JSON.stringify(title)}`);
			const sql = yield* SqlClient.SqlClient;
			yield* sql`insert into notes (title) values (${title})`;
		}),
	};
}
