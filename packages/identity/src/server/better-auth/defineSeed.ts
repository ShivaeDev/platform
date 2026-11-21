import { Config, Effect } from "effect";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { assertSeedDatabase } from "#server/better-auth/assertSeedDatabase.ts";
import type { RoleAuthDeclaration } from "#server/better-auth/define.ts";
import { mountedUserProvisioning } from "#server/better-auth/mountedUserProvisioning.ts";
import type { SeedOptions } from "#server/better-auth/SeedOptions.ts";
import { seedUsers } from "#server/better-auth/seedUsers.ts";

export function defineSeed<TRole extends string, E, R>(auth: RoleAuthDeclaration<TRole>, seed: SeedOptions<TRole, E, R>) {
	return Effect.gen(function* () {
		const url = yield* Config.Redacted("DATABASE_URL");
		yield* assertSeedDatabase(url);
		return yield* seedUsers(auth, seed).pipe(Effect.provide(mountedUserProvisioning(auth)), Effect.provide(postgresLayer(url)));
	}).pipe(Effect.scoped);
}
