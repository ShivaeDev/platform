import { betterAuth } from "better-auth";
import { Config, Effect, Layer, Redacted } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { assignRole } from "@shivaedev/identity/server/better-auth/assignRole.ts";
import { authDatabase } from "@shivaedev/identity/server/better-auth/mount.ts";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { AppAccess } from "#AppAccess.ts";
import { Owner } from "#roles/Owner.ts";
import { authOptions } from "#server/authOptions.ts";

export const createAdmin = Effect.fn("App.createAdmin")(function* () {
	const url = yield* Config.Redacted("DATABASE_URL");
	const database = yield* authDatabase(url);
	const baseUrl = yield* Config.String("PUBLIC_URL").pipe(Config.withDefault("http://127.0.0.1:3000"));
	const secret = yield* Config.Redacted("BETTER_AUTH_SECRET");
	const auth = betterAuth({ ...authOptions(database), "baseURL": baseUrl, secret: Redacted.value(secret) });
	const email = yield* Config.String("ADMIN_EMAIL");
	const name = yield* Config.String("ADMIN_NAME").pipe(Config.withDefault("Administrator"));
	const password = yield* Config.Redacted("ADMIN_PASSWORD");
	const created = yield* Effect.tryPromise(() => auth.api.createUser({ body: { email, name, password: Redacted.value(password) } }));
	yield* assignRole(AppAccess, created.user.id, Owner.name).pipe(Effect.provide(Layer.merge(postgresLayer(url), Reactivity.layer)));
	return created;
});
