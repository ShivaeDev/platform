import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { credentials } from "#test-support/authHttp.ts";
import { createCookieHost } from "#test-support/createCookieHost.ts";
import { postgres } from "#test-support/postgres.ts";

const alice = credentials("alice");
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
		signIn: () =>
			Effect.promise(() => {
				story.tell("Alice signs in");
				return client.signIn.email(alice);
			}),
		signOut: () =>
			Effect.promise(async () => {
				story.tell("Alice signs out");
				const response = await fetch(
					new Request(`${baseUrl}/api/auth/sign-out`, { body: "{}", headers: { "content-type": "application/json" }, method: "POST" }),
				);
				await response.text();
				return response.status;
			}),
		signUp: () =>
			Effect.promise(() => {
				story.tell("Alice signs up");
				return client.signUp.email(alice);
			}),
	}),
});
