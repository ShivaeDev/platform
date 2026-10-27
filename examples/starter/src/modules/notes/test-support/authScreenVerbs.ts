import { Effect } from "effect";
import type { Screen } from "./screenState.ts";

export function authScreenVerbs(engine: Screen, tell: (line: string) => void) {
	function auth() {
		if (engine.auth === undefined) {
			throw new Error("The app's injected auth client is not open");
		}
		return engine.auth;
	}
	return {
		authenticated: () => engine.login.authenticated,
		authenticationAccepts: () =>
			Effect.sync(() => {
				tell("the authentication provider accepts credentials");
				engine.login.outcome = undefined;
				engine.login.unavailable = false;
			}),
		authenticationCalls: () => engine.login.calls,
		authenticationGoesOffline: () =>
			Effect.sync(() => {
				tell("the authentication provider goes offline");
				engine.login.unavailable = true;
			}),
		authRequests: () => auth().requests,
		caught: () => engine.routeErrors,
		expireSession: () =>
			Effect.sync(() => {
				tell("the notes session expires");
				engine.client.session.signedIn = false;
			}),
		href: () => {
			if (engine.history === undefined) {
				throw new Error("No app history is open");
			}
			return engine.history.location.href;
		},
		lastAuthenticationMode: () => engine.login.calls.at(-1)?.mode,
		recoverSessionCheck: () =>
			Effect.sync(() => {
				tell("the session check provider recovers");
				auth().recover();
			}),
		signOutCalls: () => engine.signOutCalls,
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
