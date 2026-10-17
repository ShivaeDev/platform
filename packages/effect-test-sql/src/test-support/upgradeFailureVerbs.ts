import { Cause, Effect, Exit } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { expect } from "vitest";
import { assertModelColumns } from "#assertModelColumns.ts";
import { migrationUpgrade } from "#migrationUpgrade.ts";
import { Item, migrations, types } from "#test/migrationUpgrade.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import type { UpgradeEngine } from "./upgradeStory.ts";
export function upgradeFailureVerbs(engine: UpgradeEngine) {
	return {
		driftIsReported: () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const resolved = yield* migrations.loader;
				const loader = Effect.succeed([...resolved, [4, "drift", Effect.succeed(sql.unsafe(engine.statement))] as const]);
				const columns = yield* migrationUpgrade({ migrations: { ...migrations, loader }, table: "items", upTo: 1 });
				expect((yield* assertModelColumns(columns, Item, types).pipe(Effect.flip)).problems).toEqual([engine.problem]);
			}),
		invalidUpgradeStatesAreRejected: () =>
			Effect.gen(function* () {
				function check(upTo: number) {
					return migrationUpgrade({ migrations, table: "items", upTo });
				}
				expect((yield* check(2).pipe(Effect.flip)).message).toBe("Migration 2 is not in the loader.");
				expect((yield* withTestTransaction(check(1)).pipe(Effect.flip)).message).toContain("outside a wrapping transaction");
				yield* check(1);
				expect((yield* check(1).pipe(Effect.flip)).message).toContain("empty migration ledger");
			}),
		upgradeFailuresKeepOldSchema: () =>
			Effect.gen(function* () {
				const failure = new Migrator.MigrationError({ kind: "ImportError", message: "loader failed" });
				const failedLoader = migrationUpgrade({ migrations: { ...migrations, loader: Effect.fail(failure) }, table: "items", upTo: 1 });
				expect(yield* failedLoader.pipe(Effect.flip)).toBe(failure);
				const resolved = yield* migrations.loader;
				const sql = yield* SqlClient.SqlClient;
				const loader = Effect.succeed([...resolved, [4, "broken", Effect.succeed(sql`alter table items drop column absent`)] as const]);
				const exit = yield* migrationUpgrade({ migrations: { ...migrations, loader }, table: "items", upTo: 1 }).pipe(Effect.exit);
				expect(Exit.isFailure(exit)).toBe(true);
				if (Exit.isFailure(exit)) {
					expect(Cause.pretty(exit.cause)).toContain("MigrationError");
				}
				expect(yield* sql`select old_name from items`).toEqual([{ "old_name": "kept" }]);
				expect(yield* sql`select migration_id from upgrade_migrations`).toEqual([{ "migration_id": 1 }]);
			}),
	};
}
