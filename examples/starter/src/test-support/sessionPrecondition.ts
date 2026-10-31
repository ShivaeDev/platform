import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { Effect, Redacted } from "effect";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { readyAuth } from "#server/adapters/readyAuth.ts";
import { authOptions } from "#server/authOptions.ts";
import { secret } from "./host.ts";

interface SessionHost {
	readonly origin: string;
	readonly secureCookies?: boolean;
}

export const sessionPrecondition = Effect.fn("AppStory.sessionPrecondition")(function* (host: SessionHost) {
	const pool = yield* betterAuthDatabase();
	const options = { ...authOptions(), database: pool };
	return yield* readyAuth(
		betterAuth({
			...options,
			advanced: { ...options.advanced, useSecureCookies: host.secureCookies ?? host.origin.startsWith("https:") },
			"baseURL": host.origin,
			plugins: [...options.plugins, testUtils()],
			secret: Redacted.value(secret),
		}),
	);
});

export const mintUser = Effect.fn("AppStory.mintUser")(function* (host: SessionHost, name: string, role?: string) {
	const auth = yield* sessionPrecondition(host);
	return yield* Effect.promise(() => signedInUser(auth, { email: `${name}@app.test`, name, ...(role === undefined ? {} : { role }) }));
});
