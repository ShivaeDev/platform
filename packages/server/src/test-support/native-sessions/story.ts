import { Effect, Fiber, Predicate, Queue, Stream } from "effect";
import { authTestDatabase } from "@shivaedev/identity/server/better-auth/testDatabase.ts";
import { databaseUrl, postgres } from "@shivaedev/identity/test-support/better-auth/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { answered } from "#test/answers.ts";
import { type Host, NATIVE_ORIGIN, startHost } from "./host.ts";
import { type Account, authRequest, client, login, register } from "./requests.ts";

interface State {
	readonly accounts: Map<string, Account>;
	enabled: boolean;
	host?: Host;
	nativeOrigins?: readonly string[];
}

export type ForgedBearer = "missing" | "unsigned" | "prefixed" | "tampered" | "malformed" | "invented";

export interface Caller {
	readonly bearer?: string;
	readonly cookie?: string;
	readonly cookieValueAsBearer?: string;
	readonly forged?: readonly [ForgedBearer, string];
	readonly origin?: string;
	readonly tokenAsBearer?: string;
}

function forgedAuthorization(kind: ForgedBearer, credential: string) {
	const [payload = ""] = credential.split(".");
	return {
		invented: "Bearer invalid.signature",
		malformed: "Bearer %broken",
		missing: "",
		prefixed: `Bearer x${credential}`,
		tampered: `Bearer ${payload}.tampered`,
		unsigned: `Bearer ${payload}`,
	}[kind];
}

export const nativeSessions = storyKit({
	after: {
		*configured(state) {
			state.host = yield* startHost(state.enabled, state.nativeOrigins);
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	create: (): State => ({ accounts: new Map(), enabled: true }),
	inspect: (state) => ({ accounts: [...state.accounts.keys()], enabled: state.enabled }),
	layer: postgres,
	name: "native bearer sessions through appHost",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "accounts"],
	verbs: (state, story) => {
		const host = state.host;
		if (host === undefined) {
			throw new Error("The native session host has not started");
		}
		let subscription: Fiber.Fiber<unknown, unknown> | undefined;
		function account(name: string) {
			const value = state.accounts.get(name);
			if (value === undefined) {
				throw new Error(`No account named ${name}`);
			}
			return value;
		}
		function headersOf(caller: Caller): Record<string, string> {
			const headers: Record<string, string> = {};
			if (caller.origin !== undefined) {
				headers.origin = caller.origin;
			}
			if (caller.bearer !== undefined) {
				headers.authorization = `Bearer ${account(caller.bearer).credential}`;
			}
			if (caller.forged !== undefined) {
				headers.authorization = forgedAuthorization(caller.forged[0], account(caller.forged[1]).credential ?? "");
			}
			if (caller.tokenAsBearer !== undefined) {
				headers.authorization = `Bearer ${account(caller.tokenAsBearer).token}`;
			}
			if (caller.cookieValueAsBearer !== undefined) {
				headers.authorization = `Bearer ${account(caller.cookieValueAsBearer).cookie.split("=")[1]}`;
			}
			if (caller.cookie !== undefined) {
				headers.cookie = account(caller.cookie).cookie;
			}
			return headers;
		}
		function nameOf(id: unknown) {
			return [...state.accounts].find(([, value]) => value.user.id === id)?.[0];
		}
		function callerWords(caller: Caller) {
			return Object.entries(caller)
				.map(([key, value]) => `${key} ${String(value)}`)
				.join(", ");
		}
		return {
			browserSignsIn: (name: string) => {
				story.tell(`${name} signs in from the browser`);
				return Effect.map(login(host, name, true), (session) => {
					state.accounts.set(`${name} in the browser`, session);
					return {
						bearerCredential: session.credential === null ? "none" : "issued",
						cookie:
							session.httpOnly && session.cookie.includes("better-auth.session_token=") ? "HttpOnly session cookie" : "no HttpOnly session cookie",
						exposedHeaders: (session.exposed ?? "").includes("set-auth-token") ? "exposes the auth token" : "no auth token",
						responseToken: session.token === undefined ? "none" : "returned",
					};
				});
			},
			credentialLeaks: (name: string) =>
				Effect.sync(() => {
					const { credential, token } = account(name);
					const secrets = { credential, "encoded credential": encodeURIComponent(credential ?? ""), token };
					const outputs = { logs: JSON.stringify(host.logs), spans: JSON.stringify(host.receiver.spans) };
					return Object.entries(outputs).flatMap(([output, text]) =>
						Object.entries(secrets)
							.filter(([, secret]) => secret !== undefined && secret !== null && secret !== "" && text.includes(secret))
							.map(([secret]) => `${secret} in ${output}`),
					);
				}),
			diagnosticMentions: (text: string) =>
				Effect.sync(() =>
					Object.entries({ logs: JSON.stringify(host.logs), spans: JSON.stringify(host.receiver.spans) })
						.filter(([, output]) => output.includes(text))
						.map(([output]) => output),
				),
			exposedHeaders: (name: string) => Effect.sync(() => account(name).exposed ?? "none"),
			hostStops: () => {
				story.tell("the host stops and flushes its diagnostics");
				return host.stop;
			},
			issuedCredential: (name: string) =>
				Effect.sync(() => {
					const { credential } = account(name);
					if (credential === null) {
						return "none";
					}
					return credential?.includes(".") ? "signed" : "unsigned";
				}),
			profile: (caller: Caller, owner: string) =>
				Effect.gen(function* () {
					story.tell(`a client with ${callerWords(caller)} reads ${owner}'s protected profile through RPC over HTTP`);
					const rpc = yield* client(host, headersOf(caller));
					const answer = yield* answered(rpc("native.profile", { owner: account(owner).user.id }));
					return Predicate.hasProperty(answer, "id") ? `${nameOf(answer.id) ?? "an unknown user"}'s profile` : answer;
				}),
			recordDiagnostics: (name: string) =>
				Effect.gen(function* () {
					story.tell(`an HTTP route records ${name}'s bearer in its diagnostics`);
					const response = yield* Effect.promise(() => fetch(`${host.baseUrl}/diagnostic`, { headers: headersOf({ bearer: name }) }));
					yield* Effect.promise(() => response.text());
				}),
			sessionExpires: () => {
				story.tell("every stored session expires");
				return authTestDatabase(host.pool).expireSessions();
			},
			sessionTokens: (caller: Caller) =>
				Effect.gen(function* () {
					const response = yield* authRequest(host, "get-session", headersOf(caller));
					const body: unknown = yield* Effect.promise(() => response.json());
					const session = Predicate.hasProperty(body, "session") ? body.session : undefined;
					return {
						bearerCredential: response.headers.get("set-auth-token") === null ? "none" : "issued",
						sessionToken: Predicate.hasProperty(session, "token") ? "returned" : "none",
					};
				}),
			sessionUser: (caller: Caller) =>
				Effect.gen(function* () {
					story.tell(`a client with ${callerWords(caller)} reads the session through the mounted auth route`);
					const response = yield* authRequest(host, "get-session", headersOf(caller));
					const body: unknown = yield* Effect.promise(() => response.json());
					return Predicate.hasProperty(body, "user") && Predicate.hasProperty(body.user, "id")
						? (nameOf(body.user.id) ?? "an unknown user")
						: "no session";
				}),
			signsInAgain: (name: string) => {
				story.tell(`${name} signs in again with her current bearer, replacing the session`);
				return Effect.map(login(host, name, false, headersOf({ bearer: name })), (session) => {
					state.accounts.set(`${name}'s replacement`, session);
				});
			},
			signsOut: (caller: Caller) =>
				Effect.gen(function* () {
					story.tell(`a client with ${callerWords(caller)} signs out through the mounted auth route`);
					const response = yield* authRequest(host, "sign-out", { origin: NATIVE_ORIGIN, ...headersOf(caller) }, {});
					yield* Effect.promise(() => response.text());
					if (!response.ok) {
						return yield* Effect.die(`Sign-out answered ${response.status}`);
					}
				}),
			subscribes: (name: string) =>
				Effect.gen(function* () {
					story.tell(`${name} opens the session-scoped socket changes subscription and receives its first event`);
					const rpc = yield* client(host, headersOf({ bearer: name }), true);
					const events = yield* Queue.unbounded<unknown>();
					subscription = yield* rpc("native.$changes", { queries: [] }).pipe(
						Stream.runForEach((event) => Queue.offer(events, event)),
						Effect.forkScoped,
					);
					yield* Queue.take(events);
				}),
			subscriptionEnding: () => (subscription === undefined ? Effect.succeed("no subscription") : answered(Fiber.join(subscription))),
		};
	},
});
export const cookieOnly = nativeSessions.trait("configured", "the default host keeps cookie-only sessions", (state) => {
	state.enabled = false;
});
export function signedIn(...names: string[]) {
	return nativeSessions.trait("accounts", "native clients sign in through the auth HTTP routes", function* (state) {
		if (state.host === undefined) {
			return yield* Effect.die("The auth host has not started");
		}
		for (const name of names) {
			const response = yield* register(state.host, name);
			yield* Effect.promise(() => response.text());
			const session = yield* login(state.host, name);
			if (state.enabled && session.credential === null) {
				return yield* Effect.die("Native sign-in did not issue a bearer credential");
			}
			state.accounts.set(name, session);
		}
	});
}

export const nativeTransport = nativeSessions.trait("configured", "the host admits the bundled WebView origin", (state) => {
	state.nativeOrigins = [NATIVE_ORIGIN];
});
