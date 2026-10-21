import { getMigrations } from "better-auth/db/migration";
import { Effect } from "effect";
import { AuthMigrationDatabase } from "#server/AuthMigrationDatabase.ts";

export const createAuth = Effect.gen(function* () {
	const database = yield* AuthMigrationDatabase;
	yield* Effect.tryPromise(async () => {
		const migration = await getMigrations({ database, emailAndPassword: { enabled: true } });
		await migration.runMigrations();
	});
});
