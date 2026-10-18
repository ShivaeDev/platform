import { Effect, Exit } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { AnnouncedRow } from "#test/AnnouncedRow.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasMigrationTables, hasNotificationRows, listeningForChanges } from "#test/sqlTraits.ts";

postgres.it(
	"migration repository writes announce only after the migration batch commits",
	[listeningForChanges(), hasNotificationRows(), hasMigrationTables()],
	function* ({ makeRepository, notificationTable, notifications, migratePostgres, migrations }) {
		const tableName = notificationTable();
		const { binding, state } = notifications();
		const rows = yield* makeRepository(AnnouncedRow, { idColumn: "id", spanPrefix: "Rows", tableName });
		const seed = Effect.gen(function* () {
			yield* rows.insert({ id: 1, parent: null });
			expect(state.payloads).toEqual([]);
		});
		const options = { lockTimeout: "5 seconds", table: migrations().ledger } as const;
		expect(yield* migratePostgres({ ...options, loader: Migrator.fromRecord({ "1_seed": seed }) }).pipe(Effect.provideContext(binding))).toEqual([
			[1, "seed"],
		]);
		yield* eventually(Effect.try(() => expect(state.payloads).toHaveLength(1)));
		const rejected = yield* migratePostgres({
			...options,
			loader: Migrator.fromRecord({
				"1_seed": seed,
				"2_rejected": rows.insert({ id: 2, parent: null }).pipe(Effect.andThen(Effect.fail("rollback"))),
			}),
		}).pipe(Effect.provideContext(binding), Effect.exit);
		expect(Exit.isFailure(rejected)).toBe(true);
		expect(yield* rows.findMany()).toEqual([{ id: 1, parent: null }]);
		yield* Effect.sleep("100 millis");
		expect(state.payloads.map((payload) => JSON.parse(payload))).toEqual([[tableName, `${tableName}:1`]]);
	},
);
