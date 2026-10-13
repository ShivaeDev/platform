import { Effect } from "effect";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
import { fleetMigrations } from "#storage/fleetMigrations.ts";

export const migrateFleet = Effect.fn("FleetStore.migrateFleet")(function* (namespace: string, legacyOnly = false) {
	return yield* migratePostgres({
		loader: fleetMigrations(namespace, legacyOnly),
		lockTimeout: "5 seconds",
		table: `${namespace}_migrations`,
	});
});
