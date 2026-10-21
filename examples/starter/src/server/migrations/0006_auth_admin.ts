import { getMigrations } from "better-auth/db/migration";
import { Effect } from "effect";
import { AuthMigrationDatabase } from "#server/AuthMigrationDatabase.ts";
import { authOptions } from "#server/authOptions.ts";

export const authAdmin = Effect.gen(function* () {
	const database = yield* AuthMigrationDatabase;
	yield* Effect.tryPromise(async () => {
		const migration = await getMigrations(authOptions(database));
		await migration.runMigrations();
	});
});
