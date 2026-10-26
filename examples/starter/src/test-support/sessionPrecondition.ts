import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { Effect, Redacted } from "effect";
import { authDatabase } from "@shivaedev/platform/server/better-auth/mount.ts";
import { signedInUser } from "@shivaedev/platform/server/better-auth/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { authOptions } from "#server/authOptions.ts";
import { type RunningHost, secret } from "./host.ts";

export const sessionPrecondition = Effect.fn("AppStory.sessionPrecondition")(function* (host: Pick<RunningHost, "origin">) {
	const database = yield* PostgresTestDatabase;
	const pool = yield* authDatabase(database.url);
	const options = authOptions(pool);
	return betterAuth({
		...options,
		advanced: { ...options.advanced, useSecureCookies: host.origin.startsWith("https:") },
		"baseURL": host.origin,
		plugins: [...options.plugins, testUtils()],
		secret: Redacted.value(secret),
	});
});

export const mintUser = Effect.fn("AppStory.mintUser")(function* (host: Pick<RunningHost, "origin">, name: string, role?: string) {
	const auth = yield* sessionPrecondition(host);
	return yield* Effect.promise(() => signedInUser(auth, { email: `${name}@app.test`, name, ...(role === undefined ? {} : { role }) }));
});
