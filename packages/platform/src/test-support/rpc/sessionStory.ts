import { Effect, Option } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type OriginPolicy, trustedOrigins } from "#server/rpc-server/origin.ts";
import { makeApp } from "./api.ts";
import { annotationsOf, createProvider, ORIGIN, signup } from "./harness.ts";
import { databaseUrl, postgres } from "./postgres.ts";
import { expireSession, signOut } from "./sessionLifecycle.ts";
import { whoamiOverWebSocket } from "./whoamiOverWebSocket.ts";

export const browser = trustedOrigins({ allow: [ORIGIN, "capacitor://localhost"], missing: "reject" });
export const sessions = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const provider = yield* createProvider(database.url);
		const apps = new Map<string, ReturnType<typeof makeApp>>();
		const accounts = new Map<string, Awaited<ReturnType<typeof signup>>>();
		yield* Effect.addFinalizer(() =>
			Effect.promise(async () => {
				await Promise.all([...apps.values()].map(({ app }) => app.dispose()));
			}),
		);
		const upgrade: { headers?: Record<string, string> } = {};
		return { accounts, apps, close: provider.close, provider, upgrade };
	},
	inspect: ({ provider, accounts }) => ({ accounts: [...accounts.keys()], lookups: provider.lookups() }),
	layer: postgres,
	name: "RPC session",
	runIf: databaseUrl !== undefined,
	stages: ["accounts"],
	verbs: (state, story) => {
		function app(policy = "browser") {
			const result = state.apps.get(policy);
			if (!result) {
				throw new Error(`No RPC server for origin policy ${policy}`);
			}
			return result;
		}
		function account(name: string) {
			const value = state.accounts.get(name);
			if (!value) {
				throw new Error(`No account named ${name}`);
			}
			return value;
		}
		function headers(name?: string, extra: Record<string, string> = {}) {
			return { origin: ORIGIN, ...(name === undefined ? {} : { cookie: account(name).cookie }), ...extra };
		}
		return {
			account,
			annotations: (message: string) => annotationsOf(app().logs, message),
			closeProvider: () =>
				Effect.promise(async () => {
					story.tell("the session provider's PostgreSQL pool closes");
					await state.close();
				}),
			expire: (name: string) => {
				story.tell(`${name}'s persisted session expires`);
				return expireSession(state.provider, account(name).token);
			},
			greeting: (name?: string, transport: Record<string, string> = headers(name), policy = "browser") =>
				Effect.promise(() => app(policy).call(transport, (client) => client.Greeting())),
			identity: (transport: Record<string, string>, policy = "browser") => {
				story.tell("the caller requests their identity over HTTP");
				return Effect.promise(() => app(policy).call(transport, (client) => client.Whoami()));
			},
			logs: () => app().logs,
			lookups: () => state.provider.lookups(),
			post: (transport: Record<string, string>, message: ReadonlyArray<readonly [string, string]>) =>
				Effect.promise(async () => {
					story.tell("a caller posts RPC message headers over HTTP");
					const response = await app().app.handler(
						new Request(`${ORIGIN}/rpc`, {
							body: JSON.stringify([{ _tag: "Request", headers: message, id: "1", payload: null, tag: "Whoami" }]),
							headers: { "content-type": "text/plain", ...transport },
							method: "POST",
						}),
					);
					return JSON.stringify(await response.json());
				}),
			readOwn: (name: string, owner: string) =>
				Effect.promise(() => app().call(headers(name), (client) => client.ReadOwn({ userId: account(owner).userId }))),
			signout: (name: string) => {
				story.tell(`${name} signs out through Better Auth`);
				return signOut(state.provider, headers(name));
			},
			spans: () => app().spans,
			websocket: (message: ReadonlyArray<readonly [string, string]>) => {
				story.tell("a caller sends RPC message headers over the WebSocket upgrade");
				const transport = state.upgrade.headers;
				if (transport === undefined) {
					throw new Error("No WebSocket upgrade headers have been configured");
				}
				return whoamiOverWebSocket(state.provider, app().origin, transport, message);
			},
			whoami: (name?: string, extra: Record<string, string> = {}, policy = "browser") => {
				story.tell(`${name ?? "an anonymous caller"} asks who they are over HTTP`);
				return Effect.promise(() => app(policy).call(headers(name, extra), (client) => client.Whoami()));
			},
		};
	},
});
export function signedUp(...names: string[]) {
	return sessions.trait("accounts", `${names.join(" and ")} sign up with Better Auth`, function* (state) {
		for (const name of names) {
			state.accounts.set(name, yield* Effect.promise(() => signup(state.provider, name)));
		}
	});
}
export function originPolicy(name = "browser", policy: OriginPolicy = browser) {
	return sessions.trait("accounts", `the ${name} origin policy guards RPC`, (state) => {
		state.apps.set(name, makeApp(state.provider, policy));
	});
}

export const publicWithoutOrigin = sessions.trait("accounts", "only public greetings allow a missing origin", (state) => {
	state.apps.set(
		"custom",
		makeApp(state.provider, (request) =>
			Option.match(request.origin, { onNone: () => request.rpc === "Greeting", onSome: (value) => value === ORIGIN }),
		),
	);
});

export function websocketHeaders(caller?: string, headers: Record<string, string> = { origin: ORIGIN }) {
	return sessions.trait("accounts", `the WebSocket upgrade carries ${caller ?? "anonymous"} transport headers`, (state) => {
		const account = caller === undefined ? undefined : state.accounts.get(caller);
		if (caller !== undefined && account === undefined) {
			throw new Error(`No account named ${caller}`);
		}
		state.upgrade.headers = { ...headers, ...(account === undefined ? {} : { cookie: account.cookie }) };
	});
}
