import { Effect, Schema } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { seedCookies } from "@shivaedev/test-story/server/seedCookies.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { createCookieHost } from "#test-support/createCookieHost.ts";
import { postgres } from "#test-support/postgres.ts";
import { mintUser } from "./sessionPrecondition.ts";

const decodeSession = Schema.decodeUnknownSync(Schema.NullOr(Schema.Struct({ user: Schema.Struct({ email: Schema.String }) })));

export const cookieApp = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		return yield* createCookieHost();
	},
	inspect: () => ({ authentication: "cookie session" }),
	layer: postgres,
	name: "cookie auth",
	stages: ["account"],
	verbs: (engine, story) => {
		const { baseUrl, fetch } = engine;
		function readSession() {
			return Effect.promise(async () => {
				const response = await fetch(new Request(`${baseUrl}/api/auth/get-session`, { cache: "no-store" }));
				const session = decodeSession(await response.json());
				return { cookieReissued: response.headers.get("set-cookie") !== null, signedInAs: session?.user.email ?? "no session" };
			});
		}
		return {
			browserSession: () => Effect.map(readSession(), ({ signedInAs }) => signedInAs),
			pageScriptCookies: () => Effect.sync(() => (document.cookie.includes("session_token") ? "includes the session token" : "no session token")),
			readsSession: () => {
				story.tell("alice's browser reads her session");
				return readSession();
			},
			signsOut: () =>
				Effect.promise(async () => {
					story.tell("alice signs out in the browser");
					const response = await fetch(
						new Request(`${baseUrl}/api/auth/sign-out`, { body: "{}", headers: { "content-type": "application/json" }, method: "POST" }),
					);
					await response.text();
				}),
		};
	},
});

export function mintedCookieSession() {
	return cookieApp.trait("account", "alice's browser holds the session cookie the app minted for her", function* (engine) {
		const { cookies } = yield* mintUser({ origin: engine.baseUrl }, "alice");
		yield* seedCookies(cookies);
	});
}
