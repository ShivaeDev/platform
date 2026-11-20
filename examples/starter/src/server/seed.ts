import { Effect, Redacted } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { defineSeed } from "@shivaedev/identity/server/better-auth/defineSeed.ts";
import { AppAccess } from "#AppAccess.ts";
import { Owner } from "#roles/Owner.ts";
import { User } from "#roles/User.ts";
import { authOptions } from "#server/authOptions.ts";

export const seed = defineSeed({
	auth: authOptions(),
	defaultRole: User.name,
	roles: AppAccess,
	run: Effect.gen(function* () {
		const user = yield* SessionUser;
		yield* Effect.logInfo(`Demo user ready: ${user.email}`);
	}),
	users: [
		{ email: "owner@demo.test", name: "Demo Owner", password: Redacted.make("local-demo-password"), role: Owner.name },
		{ email: "user@demo.test", name: "Demo User", password: Redacted.make("local-demo-password"), role: User.name },
	],
});
