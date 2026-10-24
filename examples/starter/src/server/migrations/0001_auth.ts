import { getMigrations } from "better-auth/db/migration";
import { admin } from "better-auth/plugins";
import { Effect } from "effect";
import { AuthMigrationDatabase } from "#server/AuthMigrationDatabase.ts";

export default Effect.gen(function* () {
	const database = yield* AuthMigrationDatabase;
	yield* Effect.tryPromise(async () => {
		const migration = await getMigrations({ database, emailAndPassword: { enabled: true }, plugins: [admin()] });
		await migration.runMigrations();
	});
});
