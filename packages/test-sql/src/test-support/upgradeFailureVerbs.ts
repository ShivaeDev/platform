import { Effect } from "effect";
import { type Migrator, SqlClient } from "effect/sql";
import { migrationUpgrade } from "#migrationUpgrade.ts";
import { withTestTransaction } from "#withTestTransaction.ts";
import { migrations } from "./migrationUpgrade.ts";
import type { UpgradeEngine } from "./upgradeStory.ts";
export function upgradeFailureVerbs(engine: UpgradeEngine) {
	return {
		upgradeInTransaction: () => withTestTransaction(migrationUpgrade({ migrations, table: "items", upTo: 1 })),
		upgradeTo: (upTo: number) => migrationUpgrade({ migrations, table: "items", upTo }),
		upgradeWithBrokenMigration: () =>
			Effect.gen(function* () {
				const resolved = yield* migrations.loader;
				const sql = yield* SqlClient.SqlClient;
				const loader = Effect.succeed([...resolved, [4, "broken", Effect.succeed(sql`alter table items drop column absent`)] as const]);
				return yield* migrationUpgrade({ migrations: { ...migrations, loader }, table: "items", upTo: 1 });
			}),
		upgradeWithDrift: () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const resolved = yield* migrations.loader;
				const loader = Effect.succeed([...resolved, [4, "drift", Effect.succeed(sql.unsafe(engine.statement))] as const]);
				return yield* migrationUpgrade({ migrations: { ...migrations, loader }, table: "items", upTo: 1 });
			}),
		upgradeWithFailedLoader: (failure: Migrator.MigrationError) =>
			migrationUpgrade({ migrations: { ...migrations, loader: Effect.fail(failure) }, table: "items", upTo: 1 }),
	};
}
