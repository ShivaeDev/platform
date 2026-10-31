import { DateTime, type Duration, Effect } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { signInAgain } from "@shivaedev/identity/server/better-auth/testing.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { seedCookies } from "@shivaedev/test-story/server/seedCookies.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createCookieHost } from "#test-support/createCookieHost.ts";
import { postgres } from "#test-support/postgres.ts";
import { mintUser, sessionPrecondition } from "./sessionPrecondition.ts";

export const cookieApp = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		return { ...(yield* createCookieHost()), userId: "" };
	},
	inspect: () => ({ authentication: "cookie session" }),
	layer: postgres,
	name: "cookie auth",
	stages: ["account"],
	verbs: (engine, story) => {
		const {
			baseUrl,
			auth: { client },
			fetch,
		} = engine;
		return {
			browserSignsInAgain: Effect.fn("CookieStory.browserSignsInAgain")(function* () {
				story.tell("alice signs in again in the browser");
				const auth = yield* sessionPrecondition({ origin: baseUrl });
				const { cookies } = yield* signInAgain(auth, engine.userId);
				yield* seedCookies(cookies);
			}),
			session: () =>
				Effect.promise(async () => {
					story.tell("Alice reads her cookie session");
					const response = await fetch(new Request(`${baseUrl}/api/auth/get-session`, { cache: "no-store" }));
					return { response, result: await client.getSession(), session: await response.json() };
				}),
			signOut: () =>
				Effect.promise(async () => {
					story.tell("Alice signs out");
					const response = await fetch(
						new Request(`${baseUrl}/api/auth/sign-out`, { body: "{}", headers: { "content-type": "application/json" }, method: "POST" }),
					);
					await response.text();
					return response;
				}),
			timePasses: (duration: Duration.Input) => {
				story.tell(`${duration} pass`);
				return TestClock.adjust(duration);
			},
			visibleCookies: () => document.cookie,
		};
	},
});

export function mintedCookieSession() {
	return cookieApp.trait("account", "Alice starts with a minted HttpOnly session", function* (engine) {
		const { baseUrl } = engine;
		const { cookies, user } = yield* mintUser({ origin: baseUrl }, "alice");
		engine.userId = user.id;
		yield* seedCookies(cookies);
	});
}
