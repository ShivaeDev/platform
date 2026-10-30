import { Effect, Stream } from "effect";
import { SqlClient } from "effect/sql";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { followHints } from "./followHints.ts";
import { openSessionKeysHost } from "./openSessionKeysHost.ts";
import { postChanges } from "./postChanges.ts";
import { createProvider, ORIGIN } from "./provider.ts";
import { type Boundary, Preferences } from "./sessionKeysApi.ts";
import { upgrade } from "./upgrade.ts";

const create = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table preferences (owner text not null, id text not null, value text not null, primary key (owner, id))`;
	const database = yield* PostgresTestDatabase;
	const provider = yield* createProvider(database.url);
	const alice = yield* Effect.promise(() => signedInUser(provider.auth, { email: "alice@example.test", name: "alice" }));
	const bob = yield* Effect.promise(() => signedInUser(provider.auth, { email: "bob@example.test", name: "bob" }));
	const second = yield* Effect.promise(async () => {
		const { test } = await provider.auth.$context;
		return test.login({ userId: alice.user.id });
	});
	function account(session: typeof alice) {
		return { cookie: session.cookies.map(({ name, value }) => `${name}=${value}`).join("; "), userId: session.user.id };
	}
	const aliceAccount = account(alice);
	const bobAccount = account(bob);
	const writer = yield* openSessionKeysHost(provider);
	const reader = yield* openSessionKeysHost(provider);
	const clients = {
		alice: yield* Effect.cached(writer.client(aliceAccount.cookie)),
		bob: yield* Effect.cached(reader.client(bobAccount.cookie)),
		second: yield* Effect.cached(reader.client(second.cookies.map(({ name, value }) => `${name}=${value}`).join("; "))),
	};
	return { alice: aliceAccount, bob: bobAccount, clients, provider, reader, writer };
});

export const sessionKeys = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create,
	inspect: (state) => ({ accounts: [state.alice.userId, state.bob.userId], published: state.writer.published }),
	layer: postgres,
	name: "session-scoped contract keys",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: (state, story) => ({
		accountId: (name: "alice" | "bob") => state[name].userId,
		anonymous: () =>
			Effect.gen(function* () {
				const client = yield* state.reader.client();
				return yield* client("account.$changes", { queries: [{ payload: {}, query: "list" }] }).pipe(Stream.runCollect, Effect.result);
			}),
		connections: () => ({ reader: [...state.reader.connections], writer: [...state.writer.connections] }),
		forgeScope: () =>
			Effect.gen(function* () {
				story.tell("Alice subscribes with Bob's owner, scope and physical keys in the payload");
				const client = yield* state.reader.wireClient(state.alice.cookie);
				return yield* followHints(
					client("account.$changes", {
						keys: readKeys([Preferences.item("theme")], { scope: state.bob.userId }),
						queries: [{ payload: { id: "theme", owner: state.bob.userId, scope: state.bob.userId }, query: "get" }],
						scope: state.bob.userId,
					}),
				);
			}),
		postSubscription: () => {
			story.tell("request the reserved changes stream over POST");
			return postChanges(state.writer.url, state.alice.cookie).pipe(Effect.map((exit) => JSON.stringify(exit)));
		},
		published: () => state.writer.published,
		read: (caller: keyof typeof state.clients, boundary: Boundary = "account") =>
			Effect.flatMap(state.clients[caller], (client) => client(`${boundary}.get`, { id: "theme" })),
		readWithCookie: () =>
			Effect.flatMap(state.clients.alice, (client) => client("account.get", { id: "theme" }, { headers: { cookie: state.bob.cookie } })),
		revoke: () =>
			Effect.promise(() =>
				state.provider.auth.handler(
					new Request(`${ORIGIN}/api/auth/sign-out`, {
						headers: { cookie: state.alice.cookie, origin: ORIGIN },
						method: "POST",
					}),
				),
			),
		rpcUrl: () => state.writer.url.replace(/^http/u, "ws"),
		save: (
			caller: keyof typeof state.clients,
			value: string,
			options: { announce?: boolean; reject?: boolean; id?: string; boundary?: Boundary } = {},
		) => {
			story.tell(`${caller} saves ${value} through ${options.boundary ?? "account"}`);
			return Effect.flatMap(state.clients[caller], (client) =>
				client(`${options.boundary ?? "account"}.save`, {
					announce: options.announce ?? false,
					id: options.id ?? "theme",
					reject: options.reject ?? false,
					value,
				}),
			);
		},
		sendSubscription: (payload: unknown) =>
			Effect.gen(function* () {
				const client = yield* state.reader.wireClient(state.alice.cookie);
				return yield* client("account.$changes", payload).pipe(
					Stream.runCollect,
					Effect.exit,
					Effect.map((exit) => JSON.stringify(exit)),
				);
			}),
		subscribe: (caller: keyof typeof state.clients, boundary: Boundary = "account") => {
			story.tell(`${caller} subscribes through ${boundary}`);
			return Effect.flatMap(state.clients[caller], (client) =>
				followHints(
					client(`${boundary}.$changes`, {
						queries: [
							{ payload: { id: "theme" }, query: "get" },
							{ payload: {}, query: "list" },
						],
					}),
				),
			);
		},
		unprotected: () =>
			Effect.gen(function* () {
				const client = yield* state.reader.client();
				return yield* client("unprotected.$changes", { queries: [{ payload: {}, query: "list" }] }).pipe(Stream.runCollect, Effect.exit);
			}),
		upgrade: (headers: Readonly<Record<string, string>>, trustedProxy?: string) =>
			Effect.gen(function* () {
				story.tell("attempt a WebSocket upgrade with the supplied transport headers");
				const host = yield* openSessionKeysHost(state.provider, trustedProxy);
				return yield* upgrade(host.url, { cookie: state.alice.cookie, ...headers });
			}),
	}),
});
