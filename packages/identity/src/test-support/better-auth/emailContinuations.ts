import { Effect, Redacted } from "effect";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { AuthEmail } from "#server/better-auth/emails.ts";
import { emailContinuationHost } from "#test/better-auth/emailContinuationHost.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

export const emailContinuations = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	create: emailContinuationHost,
	layer: postgres,
	name: "typed auth email continuations",
	runIf: databaseUrl !== undefined,
	stages: ["account"],
	verbs: (engine, story) => ({
		applicationOrigin: () => Effect.succeed(engine.baseUrl),
		authenticationOrigin: () => Effect.succeed(engine.authOrigin),
		deliveredLink: (kind: AuthEmail["_tag"]) =>
			Effect.sync(() => {
				const message = engine.messages.find((mail) => mail._tag === kind);
				if (message === undefined) {
					throw new Error(`No ${kind} email reached alice`);
				}
				const url = new URL(Redacted.value(message.url));
				return { callback: url.searchParams.get("callbackURL"), from: url.searchParams.get("from"), path: url.pathname };
			}),
		followEmail: (kind: AuthEmail["_tag"]) =>
			Effect.promise(async () => {
				story.tell(`alice follows her ${kind} email link`);
				const message = engine.messages.find((mail) => mail._tag === kind);
				if (message === undefined) {
					throw new Error(`No ${kind} email reached alice`);
				}
				const response = await fetch(Redacted.value(message.url));
				return { body: await response.text(), page: new URL(response.url).pathname + new URL(response.url).search, status: response.status };
			}),
		request: (path: string, callback: string, body: Record<string, string> = {}) =>
			Effect.promise(async () => {
				story.tell(`alice requests ${path} with continuation ${callback}`);
				const headers = new Headers(engine.headers);
				headers.set("content-type", "application/json");
				headers.set("origin", engine.baseUrl);
				const response = await fetch(`${engine.baseUrl}/api/auth/${path}`, {
					body: JSON.stringify({
						email: "alice@example.test",
						...(path === "request-password-reset" ? { redirectTo: callback } : { "callbackURL": callback }),
						...body,
					}),
					headers,
					method: "POST",
				});
				if (!response.ok) {
					throw new Error(`Email request answered ${response.status}: ${await response.text()}`);
				}
				await response.text();
			}),
	}),
});

export function aliceAccount(verified = false) {
	return emailContinuations.trait(
		"account",
		`alice has ${verified ? "a verified" : "an unverified"} account and a signed session`,
		function* (engine) {
			const account = yield* signedInUser(engine.auth, { email: "alice@example.test", emailVerified: verified, name: "alice" });
			engine.headers = account.headers;
		},
	);
}
