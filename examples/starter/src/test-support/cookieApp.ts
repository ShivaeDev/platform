import { Effect } from "effect";
import { expect } from "vitest";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { domFetch } from "@shivaedev/test-story/domFetch.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { credentials } from "./authHttp.ts";
import { postgres } from "./postgres.ts";
import { storyHost } from "./storyHost.ts";

const alice = credentials("alice");
export const cookieApp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const url = yield* storyHost;
		const previousLocation = window.location.href;
		const fetch = domFetch(url);
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
		return { fetch };
	},
	inspect: () => ({ authentication: "cookie session" }),
	layer: postgres,
	name: "cookie auth",
	stages: ["account"],
	verbs: ({ fetch }, story) => {
		function post(path: string, body: object) {
			return Effect.promise(async () => {
				const response = await fetch(`/api/auth/${path}`, {
					body: JSON.stringify(body),
					headers: { "content-type": "application/json" },
					method: "POST",
				});
				expect(response.status).toBe(200);
				await response.text();
			});
		}
		return {
			sessionIs: (email: string | null) =>
				Effect.promise(async () => {
					story.tell(email === null ? "Alice has no session" : "Alice reads her cookie session");
					const response = await fetch("/api/auth/get-session", { cache: "no-store" });
					expect(response.status).toBe(200);
					const session: unknown = await response.json();
					if (email === null) {
						expect(session).toBeNull();
					} else {
						expect(session).toMatchObject({ user: { email } });
					}
				}),
			signIn: () => {
				story.tell("Alice signs in");
				return post("sign-in/email", alice);
			},
			signOut: () => {
				story.tell("Alice signs out");
				return post("sign-out", {});
			},
			signUp: () => {
				story.tell("Alice signs up");
				return post("sign-up/email", alice);
			},
		};
	},
});
