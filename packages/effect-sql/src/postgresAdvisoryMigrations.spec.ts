import { Effect, Fiber } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { waitingOn } from "#test/migrationConcurrency.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasMigrationTables } from "#test/sqlTraits.ts";

postgres.it(
	"migrations wait on the public advisory lock for their ledger",
	[hasMigrationTables()],
	function* ({ holdAdvisoryLock, migrations, migratePostgres }) {
		const { ledger } = migrations();
		const held = yield* holdAdvisoryLock(`effect_sql_migrations:${ledger}`);
		const runner = yield* migratePostgres({ loader: Migrator.fromRecord({}), lockTimeout: "5 seconds", table: ledger }).pipe(Effect.forkScoped);
		yield* eventually(waitingOn(held.pid).pipe(Effect.flatMap((waiting) => Effect.try(() => expect(waiting).toBe(true))))).pipe(
			Effect.timeout("3 seconds"),
		);
		yield* held.commit;
		yield* Fiber.join(held.fiber);
		expect(yield* Fiber.join(runner).pipe(Effect.timeout("3 seconds"))).toEqual([]);
	},
);
