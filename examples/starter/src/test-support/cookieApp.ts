import { Effect } from "effect";
import { expect } from "vitest";
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
	verbs: ({ baseUrl, auth: { client }, fetch }, story) => {
		function post(path: string, body: object) {
			return Effect.promise(async () => {
				const response = await fetch(
					new Request(`${baseUrl}/api/auth/${path}`, {
						body: JSON.stringify(body),
						headers: { "content-type": "application/json" },
						method: "POST",
					}),
				);
				expect(response.status).toBe(200);
				await response.text();
			});
		}
		return {
			sessionIs: (email: string | null) =>
				Effect.promise(async () => {
					story.tell(email === null ? "Alice has no session" : "Alice reads her cookie session");
					const response = await fetch(new Request(`${baseUrl}/api/auth/get-session`, { cache: "no-store" }));
					expect(response.ok).toBe(true);
					expect(response.status).toBe(200);
					expect(response.headers.get("content-type")).toContain("application/json");
					expect(response.headers.get("set-cookie")).toBeNull();
					const session: unknown = await response.json();
					const result = await client.getSession();
					expect(result.error).toBeNull();

					if (email === null) {
						expect(session).toBeNull();
						expect(result.data).toBeNull();
					} else {
						expect(session).toMatchObject({ user: { email } });
						expect(result.data).toMatchObject({ user: { email } });
					}
				}),
			signIn: () => {
				story.tell("Alice signs in");
				return Effect.promise(async () => {
					expect((await client.signIn.email(alice)).error).toBeNull();
				});
			},
			signOut: () => {
				story.tell("Alice signs out");
				return post("sign-out", {});
			},
			signUp: () => {
				story.tell("Alice signs up");
				return Effect.promise(async () => {
					expect((await client.signUp.email(alice)).error).toBeNull();
				});
			},
		};
	},
});
