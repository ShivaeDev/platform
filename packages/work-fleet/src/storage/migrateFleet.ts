import { Effect, type Schema } from "effect";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
import { fleetMigrations } from "#storage/fleetMigrations.ts";

export const migrateFleet = Effect.fn("FleetStore.migrateFleet")(function* (namespace: string, schema?: Schema.Top, legacyOnly = false) {
	return yield* migratePostgres({
		loader: fleetMigrations(namespace, schema, legacyOnly),
		lockTimeout: "5 seconds",
		table: `${namespace}_migrations`,
	});
});
