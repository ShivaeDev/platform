import { Config, Effect, Redacted } from "effect";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { AdminPasswordLength } from "#server/better-auth/AdminPasswordLength.ts";
import { assignRole } from "#server/better-auth/assignRole.ts";
import type { RoleAuthDeclaration } from "#server/better-auth/define.ts";
import { mountedUserProvisioning } from "#server/better-auth/mountedUserProvisioning.ts";
import { UnverifiedAdminEmail } from "#server/better-auth/UnverifiedAdminEmail.ts";
import { UserProvisioning } from "#server/UserProvisioning.ts";

export const provisionAdmin = Effect.fn("Identity.provisionAdmin")(function* <TRole extends string>(
	auth: RoleAuthDeclaration<TRole>,
	role: NoInfer<TRole>,
) {
	const email = yield* Config.String("ADMIN_EMAIL");
	const name = yield* Config.String("ADMIN_NAME").pipe(Config.withDefault("Administrator"));
	const password = yield* Config.Redacted("ADMIN_PASSWORD").pipe(Config.withDefault(Redacted.make("")));
	// Provisioning skips Better Auth's sign-up endpoint, so it applies the endpoint's password limits itself.
	const { maxPasswordLength: maximum = 128, minPasswordLength: minimum = 8 } = auth.options.emailAndPassword ?? {};
	const length = Redacted.value(password).length;
	if (length < minimum || length > maximum) {
		return yield* new AdminPasswordLength({ maximum, minimum });
	}
	const url = yield* Config.Redacted("DATABASE_URL");
	return yield* Effect.gen(function* () {
		const user = yield* (yield* UserProvisioning).findOrCreateUser({ email, name, password });
		if (!user.emailVerified) {
			return yield* new UnverifiedAdminEmail({ email: user.email });
		}
		yield* assignRole(auth, user.id, role);
		return { email: user.email, id: user.id, name: user.name };
	}).pipe(Effect.provide(mountedUserProvisioning(auth)), Effect.provide(postgresLayer(url)), Effect.scoped);
});
