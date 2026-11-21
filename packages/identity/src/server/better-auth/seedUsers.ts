import { Effect, Option } from "effect";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { Identity, SessionUser } from "#identity.ts";
import { assignRole } from "#server/better-auth/assignRole.ts";
import type { RoleAuthDeclaration } from "#server/better-auth/define.ts";
import type { SeedOptions } from "#server/better-auth/SeedOptions.ts";
import { UserProvisioning } from "#server/UserProvisioning.ts";

export const seedUsers = Effect.fn("Identity.seedUsers")(function* <TRole extends string, E, R>(
	auth: RoleAuthDeclaration<TRole>,
	seed: SeedOptions<TRole, E, R>,
) {
	const provisioning = yield* UserProvisioning;
	for (const persona of seed.users) {
		const user = yield* provisioning.findOrCreateUser(persona);
		yield* assignRole(auth, user.id, persona.role);
		const access = yield* auth.roles.resolve(persona.role);
		yield* seed.run.pipe(
			Effect.provideService(Identity, { id: user.id }),
			Effect.provideService(SessionUser, { ...user, ...access }),
			Effect.provideService(CurrentViewer, Option.some({ id: user.id })),
			Effect.annotateLogs({ userId: user.id }),
		);
	}
});
