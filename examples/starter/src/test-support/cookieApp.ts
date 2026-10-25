import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { seedCookies } from "@shivaedev/test-story/server/seedCookies.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createCookieHost } from "#test-support/createCookieHost.ts";
import { postgres } from "#test-support/postgres.ts";
import { mintUser } from "./sessionPrecondition.ts";

export const cookieApp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: createCookieHost,
	inspect: () => ({ authentication: "cookie session" }),
	layer: postgres,
	name: "cookie auth",
	stages: ["account"],
	verbs: ({ baseUrl, auth: { client }, fetch }, story) => ({
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
		visibleCookies: () => document.cookie,
	}),
});

export function mintedCookieSession() {
	return cookieApp.trait("account", "Alice starts with a minted HttpOnly session", function* ({ baseUrl }) {
		const { cookies } = yield* mintUser({ origin: baseUrl }, "alice");
		yield* seedCookies(cookies);
	});
}
