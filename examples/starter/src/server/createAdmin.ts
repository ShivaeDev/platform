import { betterAuth } from "better-auth";
import { Config, Effect, Redacted } from "effect";
import { authDatabase } from "@shivaedev/platform/server/better-auth/mount.ts";
import { authOptions } from "#server/authOptions.ts";

export const createAdmin = Effect.fn("App.createAdmin")(function* () {
	const database = yield* authDatabase(yield* Config.Redacted("DATABASE_URL"));
	const baseUrl = yield* Config.String("PUBLIC_URL").pipe(Config.withDefault("http://127.0.0.1:3000"));
	const secret = yield* Config.Redacted("BETTER_AUTH_SECRET");
	const auth = betterAuth({ ...authOptions(database), "baseURL": baseUrl, secret: Redacted.value(secret) });
	const email = yield* Config.String("ADMIN_EMAIL");
	const name = yield* Config.String("ADMIN_NAME").pipe(Config.withDefault("Administrator"));
	const password = yield* Config.Redacted("ADMIN_PASSWORD");
	return yield* Effect.tryPromise(() => auth.api.createUser({ body: { email, name, password: Redacted.value(password), role: ["admin", "owner"] } }));
});
