import { Effect } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { postgres } from "#test/sqlStory.ts";
import { hasMigrationTables } from "#test/sqlTraits.ts";

postgres.it(
	"migrations wait on the public advisory lock for their ledger",
	[hasMigrationTables()],
	function* ({ advisoryXactLock, migrations, migratePostgres, raceWithLock }) {
		const { ledger } = migrations();

		const results = yield* raceWithLock({
			effects: [migratePostgres({ loader: Migrator.fromRecord({}), lockTimeout: "5 seconds", table: ledger })],
			lock: advisoryXactLock(`effect_sql_migrations:${ledger}`),
		});

		expect(yield* Effect.forEach(results, Effect.fromResult)).toEqual([[]]);
	},
);
