import { getMigrations } from "better-auth/db/migration";
import { admin } from "better-auth/plugins";
import { Effect } from "effect";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";

export default Effect.gen(function* () {
	const database = yield* betterAuthDatabase();
	yield* Effect.tryPromise(async () => {
		const migration = await getMigrations({ database, emailAndPassword: { enabled: true }, plugins: [admin()] });
		await migration.runMigrations();
	});
});
