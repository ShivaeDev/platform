import { Effect } from "effect";
import { expect } from "vitest";
import type { Credentials } from "#client/auth.ts";
import { observeScreen } from "./screenObservations.ts";
import type { Screen } from "./screenState.ts";

export function authScreenVerbs(engine: Screen, tell: (line: string) => void) {
	const observe = observeScreen(tell);
	function auth() {
		if (engine.auth === undefined) {
			throw new Error("The app's injected auth client is not open");
		}
		return engine.auth;
	}
	return {
		authenticatedTimes: (count: number) =>
			observe(`the screen has announced successful authentication ${count} times`, () => {
				expect(engine.login.authenticated).toBe(count);
			}),
		authenticationAccepts: () =>
			Effect.sync(() => {
				tell("the authentication provider accepts credentials");
				engine.login.outcome = undefined;
				engine.login.unavailable = false;
			}),
		authenticationCallsAre: (calls: readonly { mode: string; credentials: Credentials }[]) =>
			observe(`authentication received ${JSON.stringify(calls)}`, () => {
				expect(engine.login.calls).toEqual(calls);
			}),
		authenticationGoesOffline: () =>
			Effect.sync(() => {
				tell("the authentication provider goes offline");
				engine.login.unavailable = true;
			}),
		authRequestsAre: (...urls: string[]) =>
			observe(`the auth client requested only ${JSON.stringify(urls)}`, () => {
				expect(auth().requests.map((url) => url.href)).toEqual(urls);
			}),
		expireSession: () =>
			Effect.sync(() => {
				tell("the notes session expires");
				engine.client.session.signedIn = false;
			}),
		lastAuthenticationModeIs: (mode: string) =>
			observe(`the last authentication attempt was ${mode}`, () => {
				expect(engine.login.calls.at(-1)?.mode).toBe(mode);
			}),
		recoverSessionCheck: () =>
			Effect.sync(() => {
				tell("the session check provider recovers");
				auth().recover();
			}),
		signOutCalledTimes: (count: number) =>
			observe(`the screen has called sign-out ${count} times`, () => {
				expect(engine.signOutCalls).toBe(count);
			}),
		signOutUsedAuthOrigin: (origin: string) =>
			observe(`sign-out uses the same injected auth origin ${origin}`, () => {
				expect(auth().requests.some((url) => url.pathname === "/api/auth/sign-out")).toBe(true);
				expect(auth().requests.every((url) => url.origin === origin)).toBe(true);
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
