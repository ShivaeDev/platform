import { Config, Effect } from "effect";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { assertSeedDatabase } from "#server/better-auth/adapters/assertSeedDatabase.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import type { SeedOptions } from "#server/better-auth/adapters/SeedOptions.ts";
import { betterAuthUserProvisioning } from "#server/better-auth/adapters/userProvisioning.ts";
import { seedUsers } from "#server/better-auth/seedUsers.ts";

export function defineSeed<TRole extends string, E, R>(options: SeedOptions<TRole, E, R>) {
	return Effect.gen(function* () {
		const url = yield* Config.Redacted("DATABASE_URL");
		yield* assertSeedDatabase(url);
		return yield* Effect.gen(function* () {
			const { auth } = yield* betterAuthMount(
				{ emailAndPassword: { enabled: true }, ...options.auth, database: yield* betterAuthDatabase() },
				{ defaultRole: options.defaultRole, roles: options.roles },
			).pipe(Effect.provide(memoryStore));
			return yield* seedUsers(options).pipe(Effect.provide(betterAuthUserProvisioning(auth)));
		}).pipe(Effect.provide(postgresLayer(url)));
	}).pipe(Effect.scoped);
}
