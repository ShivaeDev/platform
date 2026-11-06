import { Effect, Fiber, Queue, Stream } from "effect";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import type { Caller } from "./callers.ts";
import { callers } from "./callers.ts";
import type { Host } from "./host.ts";
import { NATIVE_ORIGIN, REVALIDATION_INTERVAL } from "./host.ts";
import { type Account, authRequest, client, login } from "./requests.ts";

export function sessionVerbs(host: Host, accounts: Map<string, Account>, tell: (line: string) => void) {
	const { account, headersOf, callerWords } = callers(accounts);
	let subscription: Fiber.Fiber<unknown, unknown> | undefined;
	function ending() {
		return subscription === undefined ? Effect.succeed("no subscription") : answered(Fiber.join(subscription));
	}
	return {
		browserSignsIn: (name: string) => {
			tell(`${name} signs in from the browser`);
			return Effect.map(login(host, name, true), (session) => {
				accounts.set(`${name} in the browser`, session);
				return {
					bearerCredential: session.credential === null ? "none" : "issued",
					cookie:
						session.httpOnly && session.cookie.includes("better-auth.session_token=") ? "HttpOnly session cookie" : "no HttpOnly session cookie",
					exposedHeaders: (session.exposed ?? "").includes("set-auth-token") ? "exposes the auth token" : "no auth token",
					responseToken: session.token === undefined ? "none" : "returned",
				};
			});
		},
		exposedHeaders: (name: string) => Effect.sync(() => account(name).exposed ?? "none"),
		issuedCredential: (name: string) =>
			Effect.sync(() => {
				const { credential } = account(name);
				if (credential === null) {
					return "none";
				}
				return credential?.includes(".") ? "signed" : "unsigned";
			}),
		revalidationIntervalPasses: () => {
			tell("one socket revalidation interval passes");
			return untilTimer(REVALIDATION_INTERVAL).pipe(Effect.andThen(passes(REVALIDATION_INTERVAL, ending())), Effect.asVoid);
		},
		sessionExpires: () => {
			tell("every stored session expires");
			return Effect.flatMap(authTestDatabase, (storage) => storage.expireSessions());
		},
		sessionProviderUnavailable: () => {
			tell("the session provider becomes unavailable");
			return Effect.sync(() => {
				host.activity.available = false;
			});
		},
		signIn: (name: string) =>
			Effect.map(login(host, name), (session) => {
				accounts.set(name, session);
			}),
		signsInAgain: (name: string) => {
			tell(`${name} signs in again with her current bearer, replacing the session`);
			return Effect.map(login(host, name, false, headersOf({ bearer: name })), (session) => {
				accounts.set(`${name}'s replacement`, session);
			});
		},
		signsOut: (caller: Caller) =>
			Effect.gen(function* () {
				tell(`a client with ${callerWords(caller)} signs out through the mounted auth route`);
				const response = yield* authRequest(host, "sign-out", { origin: NATIVE_ORIGIN, ...headersOf(caller) }, {});
				yield* Effect.promise(() => response.text());
				if (!response.ok) {
					return yield* Effect.die(`Sign-out answered ${response.status}`);
				}
			}),
		subscribes: (name: string) =>
			Effect.gen(function* () {
				tell(`${name} opens the session-scoped socket changes subscription and receives its first event`);
				const rpc = yield* client(host, headersOf({ bearer: name }), true);
				const events = yield* Queue.unbounded<unknown>();
				subscription = yield* rpc("native.$changes", { queries: [{ payload: undefined, query: "accounts" }] }).pipe(
					Stream.runForEach((event) => Queue.offer(events, event)),
					Effect.forkScoped,
				);
				yield* Queue.take(events);
			}),
		subscriptionEnding: ending,
	};
}
