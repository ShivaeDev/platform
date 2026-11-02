import { testUtils } from "better-auth/plugins";
import { Effect, Redacted } from "effect";
import { betterAuthDatabase } from "@shivaedev/identity/server/better-auth/adapters/database.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { AppAccess } from "#AppAccess.ts";
import { User } from "#roles/User.ts";
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
	const { auth } = yield* betterAuthMount(
		{
			...options,
			advanced: { ...options.advanced, useSecureCookies: host.secureCookies ?? host.origin.startsWith("https:") },
			"baseURL": host.origin,
			plugins: [testUtils()],
			secret: Redacted.value(secret),
		},
		{ defaultRole: User.name, roles: AppAccess },
	).pipe(Effect.provide(memoryStore));
	return yield* readyAuth(auth);
});

export const mintUser = Effect.fn("AppStory.mintUser")(function* (host: SessionHost, name: string, role?: string) {
	const auth = yield* sessionPrecondition(host);
	return yield* signedInUser(auth, { email: `${name}@app.test`, name, ...(role === undefined ? {} : { role }) });
});
