import { Effect, Stream } from "effect";
import { SqlClient } from "effect/sql";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { createProvider, ORIGIN, signup } from "@shivaedev/identity/test-support/rpc/harness.ts";
import { databaseUrl, postgres } from "@shivaedev/identity/test-support/rpc/postgres.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { followHints } from "./followHints.ts";
import { openSessionKeysHost } from "./openSessionKeysHost.ts";
import { type Boundary, Preferences } from "./sessionKeysApi.ts";

const create = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table preferences (owner text not null, id text not null, value text not null, primary key (owner, id))`;
	const database = yield* PostgresTestDatabase;
	const provider = yield* createProvider(database.url);
	const alice = yield* Effect.promise(() => signup(provider, "alice"));
	const bob = yield* Effect.promise(() => signup(provider, "bob"));
	const second = yield* Effect.promise(() =>
		provider.auth.handler(
			new Request(`${ORIGIN}/api/auth/sign-in/email`, {
				body: JSON.stringify({ email: "alice@example.test", password: "example-password-123" }),
				headers: { "content-type": "application/json", origin: ORIGIN },
				method: "POST",
			}),
		),
	);
	if (second.status !== 200) {
		return yield* Effect.die("Second sign-in failed");
	}
	const cookie = second.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
	const writer = yield* openSessionKeysHost(provider);
	const reader = yield* openSessionKeysHost(provider);
	const clients = {
		alice: yield* writer.client(alice.cookie),
		bob: yield* reader.client(bob.cookie),
		second: yield* reader.client(cookie),
	};
	return { alice, bob, clients, reader, writer };
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
		postSubscription: (payload: unknown) =>
			Effect.promise(async () => {
				const response = await fetch(state.reader.url, {
					body: `${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "account.$changes" })}\n`,
					headers: { "content-type": "application/ndjson", cookie: state.alice.cookie },
					method: "POST",
				});
				return response.text();
			}),
		published: () => state.writer.published,
		read: (caller: keyof typeof state.clients, boundary: Boundary = "account") => state.clients[caller](`${boundary}.get`, { id: "theme" }),
		save: (
			caller: keyof typeof state.clients,
			value: string,
			options: { announce?: boolean; reject?: boolean; id?: string; boundary?: Boundary } = {},
		) => {
			story.tell(`${caller} saves ${value} through ${options.boundary ?? "account"}`);
			return state.clients[caller](`${options.boundary ?? "account"}.save`, {
				announce: options.announce ?? false,
				id: options.id ?? "theme",
				reject: options.reject ?? false,
				value,
			});
		},
		subscribe: (caller: keyof typeof state.clients, boundary: Boundary = "account") => {
			story.tell(`${caller} subscribes through ${boundary}`);
			return followHints(
				state.clients[caller](`${boundary}.$changes`, {
					queries: [
						{ payload: { id: "theme" }, query: "get" },
						{ payload: {}, query: "list" },
					],
				}),
			);
		},
		unprotected: () =>
			Effect.gen(function* () {
				const client = yield* state.reader.client();
				return yield* client("unprotected.$changes", { queries: [{ payload: {}, query: "list" }] }).pipe(Stream.runCollect, Effect.exit);
			}),
	}),
});
