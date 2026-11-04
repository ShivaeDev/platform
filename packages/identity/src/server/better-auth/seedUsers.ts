import { Effect, Option } from "effect";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { Identity, SessionUser } from "#identity.ts";
import type { SeedOptions } from "#server/better-auth/adapters/SeedOptions.ts";
import { UserProvisioning } from "#server/UserProvisioning.ts";
import { assignRole } from "./assignRole.ts";

export const seedUsers = Effect.fn("Identity.seedUsers")(function* <TRole extends string, E, R>(options: SeedOptions<TRole, E, R>) {
	const provisioning = yield* UserProvisioning;
	for (const persona of options.users) {
		const user = yield* provisioning.findOrCreateUser(persona);
		yield* assignRole(options.roles, user.id, persona.role, options.auth);
		const access = yield* options.roles.resolve(persona.role);
		yield* options.run.pipe(
			Effect.provideService(Identity, { id: user.id }),
			Effect.provideService(SessionUser, { ...user, ...access }),
			Effect.provideService(CurrentViewer, Option.some({ id: user.id })),
			Effect.annotateLogs({ userId: user.id }),
		);
	}
});
