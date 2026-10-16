import { Effect } from "effect";
import { expect } from "vitest";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { domFetch } from "@shivaedev/test-story/domFetch.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { makeAuth } from "#client/auth.ts";
import { credentials } from "./authHttp.ts";
import { startHost } from "./host.ts";
import { postgres } from "./postgres.ts";

const alice = credentials("alice");
export const cookieApp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const { baseUrl } = yield* startHost();
		const previousLocation = window.location.href;
		const fetch = domFetch(baseUrl);
		yield* Effect.addFinalizer(() =>
			Effect.promise(async () => {
				try {
					const response = await fetch("/api/auth/sign-out", { body: "{}", headers: { "content-type": "application/json" }, method: "POST" });
					expect(response.status).toBe(200);
					await response.text();
				} finally {
					window.location.href = previousLocation;
				}
			}).pipe(Effect.timeout("5 seconds"), Effect.orDie),
		);
		return { baseUrl, client: makeAuth({ baseUrl }).client, fetch };
	},
	inspect: () => ({ authentication: "cookie session" }),
	layer: postgres,
	name: "cookie auth",
	stages: ["account"],
	verbs: ({ baseUrl, client, fetch }, story) => {
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
