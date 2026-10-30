import { Effect, Stream } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { SqlClient } from "effect/sql";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { signedInUser } from "@shivaedev/identity/server/better-auth/testing.ts";
import { answered } from "@shivaedev/test/answers.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type Feed, followHints } from "./followHints.ts";
import { openSessionKeysHost } from "./openSessionKeysHost.ts";
import { postChanges } from "./postChanges.ts";
import { createProvider, ORIGIN } from "./provider.ts";
import { type Boundary, Preferences } from "./sessionKeysApi.ts";
import { upgrade } from "./upgrade.ts";

type Caller = "alice" | "bob" | "second";

const THEME_AND_LIST = [
	{ payload: { id: "theme" }, query: "get" as const },
	{ payload: {}, query: "list" as const },
];

function publishedWords(keys: readonly unknown[], accountName: (scope: string) => string) {
	const scopes = new Set<string>();
	const own = keys.map((key) => {
		const match = /^\["session","(?<scope>[^"]+)"\]:(?<key>.+)$/u.exec(String(key));
		if (match?.groups === undefined) {
			return `unscoped ${String(key)}`;
		}
		scopes.add(accountName(match.groups.scope ?? ""));
		return match.groups.key;
	});
	return `${own.join(" and ")} for ${[...scopes].join(" and ")}`;
}

function socketWords(url: string) {
	return (address: string) => (address === url.replace(/^http/u, "ws") ? "the host's RPC socket" : address);
}

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
	return { alice: aliceAccount, bob: bobAccount, clients, feeds: new Map<string, Feed>(), provider, reader, writer };
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
	verbs: (state, story) => {
		const names: Record<Caller, string> = { alice: "alice", bob: "bob", second: "alice's second session" };
		function feed(name: string) {
			const found = state.feeds.get(name);
			return found === undefined ? Effect.die(`${name} has not subscribed`) : Effect.succeed(found);
		}
		function save(caller: Caller, value: string, options: { announce?: boolean; boundary?: Boundary; id?: string; reject?: boolean } = {}) {
			return answered(
				Effect.flatMap(state.clients[caller], (client) =>
					client(`${options.boundary ?? "account"}.save`, {
						announce: options.announce ?? false,
						id: options.id ?? "theme",
						reject: options.reject ?? false,
						value,
					}),
				),
			);
		}
		function hintsUntil(name: string, hint: string) {
			return Effect.gen(function* () {
				const subscription = yield* feed(name);
				while (subscription.hints.at(-1) !== hint) {
					yield* subscription.next;
				}
				return [...subscription.hints];
			});
		}
		function accountName(scope: string) {
			const accounts = new Map([
				[state.alice.userId, "alice"],
				[state.bob.userId, "bob"],
			]);
			return accounts.get(scope) ?? "an unknown account";
		}
		return {
			aliceSignsOut: () =>
				Effect.gen(function* () {
					story.tell("alice signs out of her first session");
					const response = yield* Effect.promise(() =>
						state.provider.auth.handler(
							new Request(`${ORIGIN}/api/auth/sign-out`, { headers: { cookie: state.alice.cookie, origin: ORIGIN }, method: "POST" }),
						),
					);
					if (response.status !== HttpStatus.fromLiteral("OK")) {
						return yield* Effect.die(`Sign-out answered ${response.status}`);
					}
				}),
			anonymousSubscription: () => {
				story.tell("a visitor without a session subscribes to account changes");
				return answered(
					Effect.flatMap(state.reader.client(), (client) =>
						client("account.$changes", { queries: [{ payload: {}, query: "list" }] }).pipe(Stream.runCollect),
					),
				);
			},
			forgedSubscription: () =>
				Effect.gen(function* () {
					story.tell("alice subscribes with bob's owner, scope and physical keys in the payload");
					const client = yield* state.reader.wireClient(state.alice.cookie);
					const subscription = yield* followHints(
						client("account.$changes", {
							keys: readKeys([Preferences.item("theme")], { scope: state.bob.userId }),
							queries: [{ payload: { id: "theme", owner: state.bob.userId, scope: state.bob.userId }, query: "get" }],
							scope: state.bob.userId,
						}),
					);
					state.feeds.set("forged", subscription);
				}),
			hintsUntil,
			hintsUntilOwnBarrier: (caller: Caller, boundary: Boundary = "account") =>
				Effect.gen(function* () {
					yield* save(caller, "barrier", { boundary, id: "other" });
					return yield* hintsUntil(caller, "changed the list");
				}),
			nextHint: (name: string) => Effect.flatMap(feed(name), (subscription) => subscription.next),
			postSubscription: () => {
				story.tell("alice requests the reserved changes stream over POST");
				return answered(postChanges(state.writer.url, state.alice.cookie));
			},
			published: () => Effect.sync(() => state.writer.published.map((keys) => publishedWords(keys, accountName))),
			read: (caller: Caller, boundary: Boundary = "account") =>
				answered(Effect.flatMap(state.clients[caller], (client) => client(`${boundary}.get`, { id: "theme" }))),
			readWithBobsCookie: () => {
				story.tell("alice reads her theme with bob's cookie in the RPC message headers");
				return answered(
					Effect.flatMap(state.clients.alice, (client) => client("account.get", { id: "theme" }, { headers: { cookie: state.bob.cookie } })),
				);
			},
			save: (caller: Caller, value: string, options: { announce?: boolean; boundary?: Boundary; id?: string; reject?: boolean } = {}) => {
				story.tell(`${names[caller]} saves ${value} as ${options.id ?? "theme"} through ${options.boundary ?? "account"}`);
				return save(caller, value, options);
			},
			savesAtOnce: (saves: readonly (readonly [Caller, string])[], boundary: Boundary = "account") => {
				story.tell(`${saves.map(([caller, value]) => `${names[caller]} saves ${value}`).join(" while ")} through ${boundary}`);
				return Effect.all(
					saves.map(([caller, value]) => save(caller, value, { boundary })),
					{ concurrency: "unbounded" },
				);
			},
			socketsOpened: () =>
				Effect.sync(() => ({
					reader: state.reader.connections.map(socketWords(state.reader.url)),
					writer: state.writer.connections.map(socketWords(state.writer.url)),
				})),
			subscribe: (caller: Caller, boundary: Boundary = "account") =>
				Effect.gen(function* () {
					story.tell(`${names[caller]} subscribes to its theme and list through ${boundary}`);
					const client = yield* state.clients[caller];
					const subscription = yield* followHints(client(`${boundary}.$changes`, { queries: THEME_AND_LIST }));
					state.feeds.set(caller, subscription);
				}),
			subscriptionOutcome: (caller: Caller) =>
				Effect.gen(function* () {
					const subscription = yield* feed(caller);
					const ending = yield* subscription.ending;
					return { ending, hints: [...subscription.hints] };
				}),
			subscriptionWithPayload: (payload: unknown) => {
				story.tell(`alice subscribes with the payload ${JSON.stringify(payload)}`);
				return answered(
					Effect.flatMap(state.reader.wireClient(state.alice.cookie), (client) => client("account.$changes", payload).pipe(Stream.runCollect)),
				);
			},
			unprotectedSubscription: () => {
				story.tell("a visitor subscribes to a scoped contract that has no session middleware");
				return answered(
					Effect.flatMap(state.reader.client(), (client) =>
						client("unprotected.$changes", { queries: [{ payload: {}, query: "list" }] }).pipe(Stream.runCollect),
					),
				);
			},
			upgrade: (headers: Readonly<Record<string, string>>, trustedProxy?: string) =>
				Effect.gen(function* () {
					story.tell(
						`alice opens a WebSocket with ${JSON.stringify(headers)}${trustedProxy === undefined ? "" : ` to a host trusting ${trustedProxy}`}`,
					);
					const host = yield* openSessionKeysHost(state.provider, trustedProxy);
					return yield* upgrade(host.url, { cookie: state.alice.cookie, ...headers });
				}),
		};
	},
});
