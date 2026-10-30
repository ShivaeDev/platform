import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { Effect, type Redacted } from "effect";
import { authDatabase } from "@shivaedev/identity/server/better-auth/mount.ts";

export const ORIGIN = "http://localhost:3000";

export const createProvider = Effect.fnUntraced(function* (url: Redacted.Redacted<string>) {
	const database = yield* authDatabase(url, { max: 2 });
	const options = {
		"baseURL": ORIGIN,
		database,
		plugins: [testUtils()],
		secret: "integration-only-secret-with-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
	};
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const auth = betterAuth(options);
	return { auth, getSession: (headers: Headers) => auth.api.getSession({ headers }) };
});

export type Provider = Effect.Success<ReturnType<typeof createProvider>>;
