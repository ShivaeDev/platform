import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { Effect } from "effect";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";

export const ORIGIN = "http://localhost:3000";

export const createProvider = Effect.fnUntraced(function* () {
	const database = yield* betterAuthDatabase();
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
