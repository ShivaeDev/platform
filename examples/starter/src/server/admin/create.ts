import { Config, Effect, Redacted } from "effect";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { assignRole } from "@shivaedev/identity/server/better-auth/assignRole.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { AppAccess } from "#AppAccess.ts";
import { Owner } from "#roles/Owner.ts";
import { User } from "#roles/User.ts";
import { readyAuth } from "#server/adapters/readyAuth.ts";
import { authOptions } from "#server/authOptions.ts";

export const createAdmin = Effect.fn("App.createAdmin")(
	function* () {
		const database = yield* betterAuthDatabase();
		const baseUrl = yield* Config.String("PUBLIC_URL").pipe(Config.withDefault("http://127.0.0.1:3000"));
		const secret = yield* Config.Redacted("BETTER_AUTH_SECRET");
		const { auth } = yield* betterAuthMount(
			{ ...authOptions(), "baseURL": baseUrl, database, secret: Redacted.value(secret) },
			{ defaultRole: User.name, roles: AppAccess },
		);
		yield* readyAuth(auth);
		const email = yield* Config.String("ADMIN_EMAIL");
		const name = yield* Config.String("ADMIN_NAME").pipe(Config.withDefault("Administrator"));
		const password = yield* Config.Redacted("ADMIN_PASSWORD");
		const created = yield* Effect.tryPromise(() => auth.api.signUpEmail({ body: { email, name, password: Redacted.value(password) } }));
		yield* assignRole(AppAccess, created.user.id, Owner.name);
		return created;
	},
	(effect) =>
		Effect.gen(function* () {
			const url = yield* Config.Redacted("DATABASE_URL");
			return yield* effect.pipe(Effect.provide(postgresLayer(url)));
		}),
);
