import { DateTime, Effect, Stream } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { SqlClient } from "effect/sql";
import { signedInUser, signInAgain } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { createProvider, ORIGIN } from "./createProvider.ts";
import { type Feed, followHints } from "./followHints.ts";
import { openSessionKeysHost } from "./openSessionKeysHost.ts";
import { postChanges } from "./postChanges.ts";
import type { Boundary } from "./sessionKeysApi.ts";
import { upgrade } from "./upgrade.ts";

type Caller = "alice" | "bob" | "second";

const THEME_AND_LIST = [
	{ payload: { id: "theme" }, query: "get" as const },
	{ payload: {}, query: "list" as const },
];

function socketWords(url: string) {
	return (address: string) => (address === url.replace(/^http/u, "ws") ? "the host's RPC socket" : address);
}

const create = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table preferences (owner text not null, id text not null, value text not null, primary key (owner, id))`;
	const provider = yield* createProvider();
	const alice = yield* signedInUser(provider.auth, { email: "alice@example.test", name: "alice" });
	const bob = yield* signedInUser(provider.auth, { email: "bob@example.test", name: "bob" });
	const second = yield* signInAgain(provider.auth, alice.user.id);
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
	clock: DateTime.makeUnsafe("2100-01-01T00:00:00Z"),
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
			hintsUntil,
			hintsUntilOwnBarrier: (caller: Caller, boundary: Boundary = "account") =>
				Effect.gen(function* () {
					yield* save(caller, "barrier", { boundary, id: "other" });
					return yield* hintsUntil(caller, "changed the list");
				}),
			nextHint: (name: string) => Effect.flatMap(feed(name), (subscription) => subscription.next),
			postSubscription: () => {
				story.tell("alice requests the reserved changes stream over POST");
				return answered(postChanges(state.writer.url, state.alice.cookie), (error) => (error instanceof Error ? error.message : String(error)));
			},
			published: () => Effect.sync(() => state.writer.published.map((keys) => keys.join(" and "))),
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
