import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Context, Deferred, Effect, Layer, Option, Scope, Stream, SubscriptionRef } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { appDatabase } from "@shivaedev/server/appDatabase.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import type { QueryUpdate } from "#queryUpdate.ts";
import { CurrentViewer } from "#readPolicy.ts";
import { handlers, migrations, Pause, Shelves, Viewer } from "#test/recorded-reads/fixture.ts";

export interface Watch {
	readonly connection: Scope.Closeable;
	readonly updates: SubscriptionRef.SubscriptionRef<readonly QueryUpdate[]>;
}

export interface Hold {
	readonly reached: Deferred.Deferred<void>;
	readonly released: Deferred.Deferred<void>;
}

export const engine = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const scope = yield* Effect.scope;
	const holds: { armed: Hold | undefined; next: Hold | undefined } = { armed: undefined, next: undefined };
	const pause = Layer.succeed(Pause, {
		betweenStatements: Effect.suspend(() => {
			const hold = holds.next;
			holds.next = undefined;
			return hold === undefined ? Effect.void : Deferred.succeed(hold.reached, undefined).pipe(Effect.andThen(Deferred.await(hold.released)));
		}),
	});
	const databaseServices = yield* Layer.build(appDatabase({ config: { databaseUrl: database.url }, migrations, postgresSettings: {} }));
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Shelves,
			handlers: Layer.merge(
				handlers.pipe(Layer.provide(pause)),
				Layer.succeed(Viewer, (effect) => Effect.provideService(effect, CurrentViewer, Option.some({ id: "alice" }))),
			),
			policy: "loopback",
			services: Layer.succeedContext(databaseServices),
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	const socketUrl = `ws://127.0.0.1:${server.address.port}/rpc`;
	const connect = Effect.fnUntraced(function* (query: "shelf" | "catalog") {
		const connection = yield* Scope.fork(scope);
		const socket = yield* Layer.buildWithScope(
			RpcClient.layerProtocolSocket().pipe(Layer.provide([layerWebSocket(socketUrl), RpcSerialization.layerNdjson])),
			connection,
		);
		const rpc = yield* RpcClient.make(Shelves, { flatten: true }).pipe(Effect.provideContext(socket), Scope.provide(connection));
		const updates = yield* SubscriptionRef.make<readonly QueryUpdate[]>([]);
		yield* rpc("shelves.$changes", { queries: [{ payload: undefined, query }] }).pipe(
			Stream.runForEach((update) => SubscriptionRef.update(updates, (all) => [...all, update])),
			Effect.forkIn(connection),
		);
		return { connection, rpc, updates };
	});
	const catalog = yield* connect("catalog");
	yield* until(SubscriptionRef.changes(catalog.updates), (all) => all.length > 0, { name: "open catalog" });
	const shelf: { current: Watch | undefined } = { current: undefined };
	return { catalog, connect, holds, shelf };
});
