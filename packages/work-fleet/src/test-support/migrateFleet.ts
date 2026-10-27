import { Effect } from "effect";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { fleetMigrations } from "#storage/fleetMigrations.ts";

export const migrateFleet = Effect.fn("FleetFixture.migrateFleet")(function* (namespace: string, lastMigration?: string) {
	const loader = Effect.gen(function* () {
		const migrations = yield* fleetMigrations(namespace);
		if (lastMigration === undefined) {
			return migrations;
		}
		const last = migrations.findIndex(([, name]) => name === lastMigration);
		if (last === -1) {
			return yield* Effect.die(`Unknown Fleet migration: ${lastMigration}`);
		}
		return migrations.slice(0, last + 1);
	});
	return yield* migratePostgres({ loader, lockTimeout: "5 seconds", table: `${namespace}_migrations` });
});
