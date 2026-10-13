import { Effect } from "effect";
import { fleetMigrations } from "#storage/fleetMigrations.ts";

export function modelTableMigrations(namespace: string) {
	return fleetMigrations(namespace).pipe(Effect.map((migrations) => migrations.filter(([id]) => id <= 6)));
}
