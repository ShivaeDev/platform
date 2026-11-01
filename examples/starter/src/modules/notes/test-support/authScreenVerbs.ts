import { Effect } from "effect";
import { act } from "react";
import { countWords } from "@shivaedev/test/answers.ts";
import { screenActions } from "./screenActions.ts";
import type { Screen } from "./screenState.ts";

export function authScreenVerbs(engine: Screen, tell: (line: string) => void) {
	function auth() {
		if (engine.auth === undefined) {
			throw new Error("The app's injected auth client is not open");
		}
		return engine.auth;
	}
	const quietly = screenActions(engine, () => undefined);
	return {
		authenticated: () =>
			Effect.sync(() =>
				engine.login.authenticated.length === 0 ? "not authenticated" : `authenticated by ${engine.login.authenticated.join(" then ")}`,
			),
		authenticationCalls: () => Effect.sync(() => engine.login.calls),
		authRequests: () => Effect.sync(() => auth().requests.map((url) => `${url.host}${url.pathname}`)),
		expireSession: () =>
			Effect.sync(() => {
				tell("alice's notes session expires");
				engine.client.session.signedIn = false;
			}),
		href: () =>
			Effect.sync(() => {
				if (engine.history === undefined) {
					throw new Error("No app history is open");
				}
				return engine.history.location.href;
			}),
		recoverSessionCheck: () =>
			Effect.sync(() => {
				tell("the session check provider recovers");
				auth().recover();
			}),
		refreshSession: () =>
			Effect.promise(async () => {
				tell("the app's auth client refreshes the session");
				const session = auth().auth.client.$store.atoms.session;
				if (session === undefined) {
					throw new Error("The auth client has no session atom");
				}
				await act(async () => {
					await session.get().refetch();
				});
			}),
		sessionChecks: () =>
			Effect.sync(() => countWords(auth().requests.filter((url) => url.pathname === "/api/auth/get-session").length, "session check")),
		signOutCalls: () => Effect.sync(() => countWords(engine.signOutCalls.length, "sign-out request")),
		submitsCredentials: (mode: "sign-in" | "sign-up") =>
			Effect.gen(function* () {
				tell(`alice submits her ${mode} details`);
				if (mode === "sign-up") {
					yield* quietly.click("Create an account");
					yield* quietly.enter("Alice", "Name");
				}
				yield* quietly.enter("alice@app.test", "Email");
				yield* quietly.enter("correct-horse", "Password");
				yield* quietly.submit();
			}),
		switchSession: (id: string) =>
			Effect.promise(async () => {
				tell(`the authentication owner switches to ${id}'s session`);
				if (engine.switchSession === undefined) {
					throw new Error("A session app is not open");
				}
				await engine.switchSession(id);
			}),
	};
}
