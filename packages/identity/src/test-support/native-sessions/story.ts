import { Effect, Fiber, Queue, Stream } from "effect";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { passwordUser, signedInUser } from "#server/better-auth/testing.ts";
import { type Host, NATIVE_ORIGIN, startHost } from "./host.ts";
import { type Account, authRequest, client, login } from "./requests.ts";

interface State {
	readonly accounts: Map<string, Account>;
	enabled: boolean;
	host?: Host;
	nativeOrigins?: readonly string[];
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
		function account(name: string) {
			const value = state.accounts.get(name);
			if (value === undefined) {
				throw new Error(`No account named ${name}`);
			}
			return value;
		}
		function bearer(name: string) {
			return { authorization: `Bearer ${account(name).credential}` };
		}
		return {
			account,
			bearer,
			browserLogin: (name: string) => login(host, name, true),
			diagnostics: () => ({ logs: JSON.stringify(host.logs), spans: JSON.stringify(host.receiver.spans) }),
			expire: () => authTestDatabase(host.pool).expireSessions(),
			getSession: (headers: Record<string, string>) =>
				Effect.gen(function* () {
					story.tell("read the session through the mounted auth route");
					const response = yield* authRequest(host, "get-session", headers);
					return { body: yield* Effect.promise(() => response.json()), credential: response.headers.get("set-auth-token"), status: response.status };
				}),
			profile: (name: string, headers: Record<string, string> = bearer(name), owner = name) =>
				Effect.gen(function* () {
					story.tell("read a protected profile through RPC over HTTP");
					const rpc = yield* client(host, headers);
					return yield* rpc("native.profile", { owner: account(owner).user.id }).pipe(Effect.result);
				}),
			recordDiagnostics: (name: string) =>
				Effect.gen(function* () {
					story.tell("the HTTP route records the bearer in diagnostics");
					const response = yield* Effect.promise(() => fetch(`${host.baseUrl}/diagnostic`, { headers: bearer(name) }));
					yield* Effect.promise(() => response.text());
				}),
			replace: (name: string) => login(host, name, false, bearer(name)),
			signIn: (name: string) =>
				Effect.map(login(host, name), (session) => {
					state.accounts.set(name, session);
				}),
			signout: (name: string, headers = bearer(name)) =>
				Effect.gen(function* () {
					story.tell("sign out through the mounted auth route");
					const response = yield* authRequest(host, "sign-out", { origin: NATIVE_ORIGIN, ...headers }, {});
					yield* Effect.promise(() => response.text());
					return response.status;
				}),
			stopHost: () => host.stop,
			subscribe: (name: string) =>
				Effect.gen(function* () {
					story.tell("open the session-scoped socket changes subscription");
					const rpc = yield* client(host, bearer(name), true);
					const events = yield* Queue.unbounded<unknown>();
					const fiber = yield* rpc("native.$changes", { queries: [] }).pipe(
						Stream.runForEach((event) => Queue.offer(events, event)),
						Effect.result,
						Effect.forkScoped,
					);
					return { ended: Fiber.join(fiber), next: Queue.take(events) };
				}),
		};
	},
});
export const cookieOnly = nativeSessions.trait("configured", "the default host keeps cookie-only sessions", (state) => {
	state.enabled = false;
});
export function signedIn(...names: string[]) {
	return accounts(names, false);
}

export function passwordAccount(name: string) {
	return accounts([name], true);
}

function accounts(names: readonly string[], password: boolean) {
	return nativeSessions.trait("accounts", "clients start with minted sessions", function* (state) {
		if (state.host === undefined) {
			return yield* Effect.die("The auth host has not started");
		}
		for (const name of names) {
			const auth = state.host.auth;
			const fields = { email: `${name}@example.test`, name, role: "user" };
			const session = password
				? yield* passwordUser(auth, { ...fields, password: "story-password-123" }).pipe(
						Effect.flatMap((user) => Effect.promise(async () => (await auth.$context).test.login({ userId: user.id }))),
					)
				: yield* Effect.promise(() => signedInUser(auth, fields));
			const credential = decodeURIComponent(session.cookies.find((cookie) => cookie.name.endsWith("session_token"))?.value ?? "");
			state.accounts.set(name, {
				cookie: session.headers.get("cookie") ?? "",
				credential: state.enabled ? credential : null,
				token: credential.split(".")[0] ?? "",
				user: { email: session.user.email, id: session.user.id, name: session.user.name },
			});
		}
	});
}

export const nativeTransport = nativeSessions.trait("configured", "the host admits the bundled WebView origin", (state) => {
	state.nativeOrigins = [NATIVE_ORIGIN];
});
