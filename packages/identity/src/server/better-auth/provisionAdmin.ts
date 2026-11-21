import { Config, Effect } from "effect";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { assignRole } from "#server/better-auth/assignRole.ts";
import type { RoleAuthDeclaration } from "#server/better-auth/define.ts";
import { mountedUserProvisioning } from "#server/better-auth/mountedUserProvisioning.ts";
import { UserProvisioning } from "#server/UserProvisioning.ts";

export const provisionAdmin = Effect.fn("Identity.provisionAdmin")(function* <TRole extends string>(
	auth: RoleAuthDeclaration<TRole>,
	role: NoInfer<TRole>,
) {
	const email = yield* Config.String("ADMIN_EMAIL");
	const name = yield* Config.String("ADMIN_NAME").pipe(Config.withDefault("Administrator"));
	const password = yield* Config.Redacted("ADMIN_PASSWORD");
	const url = yield* Config.Redacted("DATABASE_URL");
	return yield* Effect.gen(function* () {
		const user = yield* (yield* UserProvisioning).findOrCreateUser({ email, name, password });
		yield* assignRole(auth, user.id, role);
		return user;
	}).pipe(Effect.provide(mountedUserProvisioning(auth)), Effect.provide(postgresLayer(url)), Effect.scoped);
});
