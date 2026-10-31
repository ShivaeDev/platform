import { Config, Effect, Layer, Option, Schema, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcMiddleware, RpcTest } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { bind } from "#bind.ts";
import { contract } from "#contract.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import { query } from "#operation.ts";
import { querySubscription } from "#querySubscription.ts";
import { authorizeReads } from "#readPolicy.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { answered } from "#test/answers.ts";
import { watchHints } from "#testing.ts";

class ServiceUnavailable extends Schema.TaggedError<ServiceUnavailable>()("ServiceUnavailable", {}) {}
class Guard extends RpcMiddleware.Service<Guard>()("test/ReadPolicyGuard", { error: Schema.Union([MissingReadPolicy, QueryReadDenied]) }) {}
const Read = query("read", {
	readPolicy: () =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const rows = yield* sql<{ allowed: boolean }>`select policy_access() as allowed`.pipe(
				Effect.catchTag("SqlError", () => Effect.fail(new ServiceUnavailable())),
			);
			return rows[0]?.allowed === true;
		}),
	reads: () => [],
	rejections: { ServiceUnavailable },
	success: Schema.String,
});
const Reads = contract("reads", { queries: [Read] }).middleware(Guard);
const viewer = Option.some({ id: "alice" });
const layer = Layer.unwrap(
	Effect.map(Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL"), (url) => makePostgresTestLayer({ initialize: Effect.void, url })),
);

export const readPolicyStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create function policy_access() returns boolean language sql as 'select true'`;
		const live = yield* makeLiveServer.pipe(Effect.provide(Reactivity.layer));
		const handlers = Reads.toLayer({
			"reads.$changes": ({ queries }, { rpc }) =>
				Stream.unwrap(Effect.map(querySubscription(rpc, queries, viewer), (subscription) => live.subscribe(subscription))),
			"reads.read": () => Effect.succeed("Alice's note"),
		}).pipe(Layer.provide(Layer.succeed(SqlClient.SqlClient, sql)));
		const protocol = handlers.pipe(Layer.provideMerge(Layer.succeed(Guard, (effect, request) => authorizeReads(effect, request, viewer))));
		class Client extends AtomRpc.Service<Client>()("test/ReadPolicyClient", {
			group: Reads,
			makeEffect: RpcTest.makeClient(Reads, { flatten: true }),
			protocol,
		}) {}
		const registry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(value) => Effect.sync(() => value.dispose()),
		);
		const client = yield* RpcTest.makeClient(Reads, { flatten: true }).pipe(Effect.provide(protocol));
		return { api: bind(Reads, Client, { registry }), client, live, registry, sql };
	},
	inspect: ({ registry }) => ({ mountedAtoms: registry.getNodes().size, viewer: Option.getOrNull(viewer) }),
	layer,
	name: "fallible live read policies",
	stages: [],
	verbs: ({ api, client, live, registry, sql }, story) => {
		let finished: Effect.Effect<void, unknown> | undefined;
		return {
			announce: () => {
				story.tell("the server asks live readers to resync and rechecks their access");
				return Effect.asVoid(live.resync);
			},
			failDatabase: () => {
				story.tell("PostgreSQL reports a connection failure when checking note access");
				return sql`create or replace function policy_access() returns boolean language plpgsql as $$begin raise exception 'connection lost' using errcode = '08006'; end$$`;
			},
			liveRead: () => {
				story.tell("alice opens the live note");
				const read = api.read.query();
				registry.mount(read);
				registry.refresh(read);
				return answered(AtomRegistry.getResult(registry, read, { suspendOnWaiting: true }), (note) => note);
			},
			subscribe: () => {
				story.tell("alice subscribes to the note's live changes");
				return answered(
					Effect.map(watchHints(client("reads.$changes", { queries: [{ payload: undefined, query: "read" }] })), (listener) => {
						finished = listener.finished;
					}),
					() => "subscribed",
				);
			},
			subscriptionEnd: () =>
				finished === undefined ? Effect.die("Subscribe before reading the subscription's end") : answered(finished, () => "completed"),
		};
	},
});
