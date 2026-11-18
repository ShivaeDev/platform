import { layerWebSocketConstructor } from "@effect/platform-node/NodeSocket";
import { Context, Effect, type Fiber, Layer, Queue, SubscriptionRef } from "effect";
import { FetchHttpClient, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { appDatabase } from "@shivaedev/server/appDatabase.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makeClient } from "#bind.ts";
import { clientActivity } from "#clientActivity.ts";
import { Entries, handlers, migrations, type ReadGate } from "#test/reflected-postgres/fixture.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

// Each host owns its pool, its listener and its live server, as two machines behind one database would.
const host = Effect.fnUntraced(function* (reads: ReadGate) {
	const database = yield* PostgresTestDatabase;
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: Entries,
			handlers: handlers(reads),
			policy: "loopback",
			services: appDatabase({ config: { databaseUrl: database.url }, migrations, postgresSettings: {} }),
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	return `http://127.0.0.1:${server.address.port}/rpc`;
});

export const engine = Effect.gen(function* () {
	const reads: ReadGate = { held: undefined, reached: yield* Queue.unbounded<void>() };
	const unwatched: ReadGate = { held: undefined, reached: yield* Queue.unbounded<void>() };
	const url = yield* host(reads);
	const otherUrl = yield* host(unwatched);
	const runtime = yield* storyRuntime;
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const tab = makeClient(Entries, { runtime, url, webSocketConstructor: layerWebSocketConstructor });
	function run<A, E>(effect: Effect.Effect<A, E, Effect.Services<ReturnType<typeof tab.api.touch.run>>>) {
		return AtomRegistry.getResult(registry, tab.runtime.atom(effect).pipe(Atom.setIdleTTL(0)));
	}
	const http = RpcClient.layerProtocolHttp({ url: otherUrl }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	const writer = yield* RpcClient.make(Entries, { flatten: true }).pipe(Effect.provideContext(yield* Layer.build(http)));
	const flight: { command: Fiber.Fiber<string> | undefined } = { command: undefined };
	return {
		activity: clientActivity(tab),
		flight,
		reads,
		registry,
		run,
		states: yield* SubscriptionRef.make<readonly string[]>([]),
		tab,
		view: tab.api.list.query(),
		writer,
	};
});

export type ReflectedPostgresEngine = Effect.Success<typeof engine>;
